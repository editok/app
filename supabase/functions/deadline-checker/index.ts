import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APPROACHING_DAYS = 2;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface ProjectRow {
  id: string;
  order_number: string | null;
  event_name: string | null;
  deadline: string | null;
  status: string;
  editor_id: string | null;
}

interface ProfileRow {
  email: string;
  full_name: string | null;
}

interface TaskRow {
  task_name: string | null;
  assigned_to: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const approachingThreshold = new Date(today);
    approachingThreshold.setDate(approachingThreshold.getDate() + APPROACHING_DAYS);

    const todayStr = today.toISOString().slice(0, 10);
    const thresholdStr = approachingThreshold.toISOString().slice(0, 10);

    const activeStatuses = ["new", "assigned", "in-progress", "partial-completed", "fully-completed", "finished", "review", "correction", "correction_approved"];

    const { data: projects, error: projError } = await supabase
      .from("projects")
      .select("id, order_number, event_name, deadline, status, editor_id")
      .in("status", activeStatuses)
      .not("deadline", "is", null)
      .lte("deadline", thresholdStr);

    if (projError) throw new Error(`Failed to fetch projects: ${projError.message}`);

    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ checked: 0, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingLogs } = await supabase
      .from("deadline_reminder_log")
      .select("project_id, reminder_type")
      .in("project_id", projects.map((p) => p.id))
      .gte("sent_at", todayStr);

    const alreadySent = new Set<string>();
    for (const log of existingLogs || []) {
      alreadySent.add(`${log.project_id}:${log.reminder_type}`);
    }

    const editorIds = [...new Set(projects.map((p) => p.editor_id).filter((id): id is string => !!id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", editorIds);

    const profileMap = new Map<string, ProfileRow>();
    for (const p of profiles || []) {
      if (p.email) profileMap.set(p.id, { email: p.email, full_name: p.full_name });
    }

    const projectIds = projects.map((p) => p.id);
    const { data: tasks } = await supabase
      .from("tasks")
      .select("project_id, task_name, assigned_to, status")
      .in("project_id", projectIds)
      .in("status", ["assigned", "in-progress", "partial-completed", "fully-completed"]);

    const activeTaskMap = new Map<string, TaskRow>();
    for (const t of tasks || []) {
      if (!activeTaskMap.has(t.project_id)) {
        activeTaskMap.set(t.project_id, { task_name: t.task_name, assigned_to: t.assigned_to });
      }
    }

    const emailFunctionUrl = `${SUPABASE_URL}/functions/v1/send-status-email`;
    let sentCount = 0;
    const logInserts: { project_id: string; reminder_type: string }[] = [];

    for (const project of projects as ProjectRow[]) {
      if (!project.deadline) continue;

      const deadlineDate = new Date(project.deadline + "T23:59:59");
      const diffMs = deadlineDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffMs / 86400000);

      const isOverdue = daysRemaining < 0;
      const isApproaching = daysRemaining >= 0 && daysRemaining <= APPROACHING_DAYS;

      if (!isOverdue && !isApproaching) continue;

      const reminderType = isOverdue ? "overdue" : "approaching";
      const dedupKey = `${project.id}:${reminderType}`;
      if (alreadySent.has(dedupKey)) continue;

      let editorEmail: string | null = null;
      let editorName: string | null = null;

      if (project.editor_id) {
        const profile = profileMap.get(project.editor_id);
        if (profile) {
          editorEmail = profile.email;
          editorName = profile.full_name;
        }
      }

      if (!editorEmail) {
        const task = activeTaskMap.get(project.id);
        if (task?.assigned_to) {
          const profile = profileMap.get(task.assigned_to);
          if (profile) {
            editorEmail = profile.email;
            editorName = profile.full_name;
          }
        }
      }

      if (!editorEmail) continue;

      const task = activeTaskMap.get(project.id);
      const deadlineFormatted = new Date(project.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

      const variables: Record<string, string> = {
        editor_name: editorName || "there",
        project_name: project.event_name || "",
        order_number: project.order_number || "",
        deadline: deadlineFormatted,
        task_name: task?.task_name || "Current task",
      };

      if (isOverdue) {
        variables.days_remaining = `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? "s" : ""} overdue`;
      } else {
        variables.days_remaining = `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;
      }

      const response = await fetch(emailFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          templateName: "deadline_reminder",
          recipient: editorEmail,
          recipientName: editorName,
          variables,
        }),
      });

      if (response.ok) {
        sentCount++;
        logInserts.push({ project_id: project.id, reminder_type: reminderType });
      }
    }

    if (logInserts.length > 0) {
      await supabase.from("deadline_reminder_log").insert(logInserts);
    }

    return new Response(JSON.stringify({ checked: projects.length, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Deadline checker failed";
    console.error("deadline-checker error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
