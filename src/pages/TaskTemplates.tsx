import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { LayoutTemplate, Plus, Trash2, ArrowUp, ArrowDown, Layers, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import * as db from '../data/db';
import type { TaskTemplate } from '../data/db';
import { useAuth } from '../contexts/AuthContext';

interface GroupedTemplates {
  [groupName: string]: TaskTemplate[];
}

export default function TaskTemplates() {
  const { role } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddStage, setShowAddStage] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('');
  const [newStageName, setNewStageName] = useState('');
  const [newStageDesc, setNewStageDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await db.fetchTaskTemplates();
    setTemplates(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LayoutTemplate className="w-12 h-12 text-ink-300 dark:text-ink-600 mb-3" />
        <p className="text-sm font-semibold text-ink-500 dark:text-ink-400">Access Restricted</p>
        <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">Only administrators can manage task templates.</p>
      </div>
    );
  }

  const grouped: GroupedTemplates = {};
  templates.forEach((t) => {
    const g = t.group_name || 'Ungrouped';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(t);
  });
  Object.keys(grouped).forEach((g) => grouped[g].sort((a, b) => a.sort_order - b.sort_order));

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) { setError('Group name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await db.createTaskTemplate({
        task: newGroupName.trim(),
        description: null,
        category: newGroupCategory || null,
        stage: null,
        priority: 'medium',
        estimated_hours: 8,
        group_name: newGroupName.trim(),
        stages: [],
        sort_order: 0,
      });
      setShowAddGroup(false);
      setNewGroupName('');
      setNewGroupCategory('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    }
    setSaving(false);
  };

  const handleAddStage = async (groupName: string) => {
    if (!newStageName.trim()) { setError('Stage name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const groupTemplates = grouped[groupName] || [];
      const maxSort = groupTemplates.reduce((max, t) => Math.max(max, t.sort_order), 0);
      const groupTemplate = groupTemplates[0];
      const updatedStages = [...(groupTemplate?.stages || []), newStageName.trim()];

      await db.createTaskTemplate({
        task: newStageName.trim(),
        description: newStageDesc || null,
        category: groupTemplate?.category || null,
        stage: newStageName.trim(),
        priority: 'medium',
        estimated_hours: 8,
        group_name: groupName,
        stages: updatedStages,
        sort_order: maxSort + 1,
      });

      if (groupTemplate) {
        await db.updateTaskTemplate(groupTemplate.id, { stages: updatedStages });
      }

      setShowAddStage(null);
      setNewStageName('');
      setNewStageDesc('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add stage');
    }
    setSaving(false);
  };

  const moveStage = async (groupName: string, index: number, direction: 'up' | 'down') => {
    const group = grouped[groupName];
    if (!group) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= group.length) return;

    const a = group[index];
    const b = group[swapIndex];
    const aOrder = a.sort_order;
    const bOrder = b.sort_order;

    await db.updateTaskTemplate(a.id, { sort_order: bOrder });
    await db.updateTaskTemplate(b.id, { sort_order: aOrder });

    const newStages = group.map((t) => t.stage).filter(Boolean);
    const reorderedStages = [...newStages];
    [reorderedStages[index], reorderedStages[swapIndex]] = [reorderedStages[swapIndex], reorderedStages[index]];

    group.forEach((t) => {
      db.updateTaskTemplate(t.id, { stages: reorderedStages });
    });

    load();
  };

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'stage' | 'group'; name: string; template?: TaskTemplate; groupName?: string } | null>(null);

  const deleteStage = async (template: TaskTemplate) => {
    setDeleteTarget({ type: 'stage', name: template.task, template });
  };

  const deleteGroup = async (groupName: string) => {
    setDeleteTarget({ type: 'group', name: groupName, groupName });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      if (deleteTarget.type === 'stage' && deleteTarget.template) {
        await db.deleteTaskTemplate(deleteTarget.template.id);
      } else if (deleteTarget.type === 'group' && deleteTarget.groupName) {
        const group = grouped[deleteTarget.groupName];
        if (group) await Promise.all(group.map((t) => db.deleteTaskTemplate(t.id)));
      }
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
    setSaving(false);
  };

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  if (loading) return <FullPageSpinner />;

  const groupNames = Object.keys(grouped);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white">Task Templates</h2>
          <p className="text-sm text-ink-400 dark:text-ink-500 mt-0.5">Create group tasks with ordered stages for project workflows</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddGroup(true)}>Add Group</Button>
      </div>

      {groupNames.length === 0 ? (
        <Card className="animate-slide-up">
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-ink-300 dark:text-ink-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink-500 dark:text-ink-400">No task groups yet</p>
            <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">Create a group like "Album Designing" or "Video Editing" with ordered stages.</p>
            <Button variant="primary" size="sm" className="mt-4" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAddGroup(true)}>Create First Group</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4 stagger">
          {groupNames.map((groupName) => {
            const group = grouped[groupName];
            const isCollapsed = collapsedGroups.has(groupName);
            return (
              <Card key={groupName} padding={false} className="animate-slide-up overflow-hidden">
                <div className="p-4 flex items-center justify-between bg-gradient-to-r from-primary-50/50 to-transparent dark:from-primary-900/10">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleGroup(groupName)} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors">
                      {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink-900 dark:text-white">{groupName}</h3>
                      <p className="text-xs text-ink-400 dark:text-ink-500">{group.length} stage{group.length !== 1 ? 's' : ''}{group[0]?.category ? ` · ${group[0].category}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAddStage(groupName)}>Add Stage</Button>
                    <button onClick={() => deleteGroup(groupName)} className="w-8 h-8 rounded-lg hover:bg-error-50 dark:hover:bg-error-500/15 flex items-center justify-center text-ink-400 hover:text-error-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-4 space-y-2">
                    {group.length === 0 ? (
                      <p className="text-sm text-ink-400 text-center py-4">No stages yet. Click "Add Stage" to create the first one.</p>
                    ) : (
                      group.map((template, i) => (
                        <div key={template.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 dark:hover:border-primary-700 transition-all group/stage">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveStage(groupName, i, 'up')}
                              disabled={i === 0}
                              className="w-6 h-5 rounded flex items-center justify-center text-ink-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveStage(groupName, i, 'down')}
                              disabled={i === group.length - 1}
                              className="w-6 h-5 rounded flex items-center justify-center text-ink-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">
                            {i + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{template.task}</p>
                            {template.description && <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{template.description}</p>}
                          </div>

                          <Badge status="active">Stage {i + 1}</Badge>

                          <button
                            onClick={() => deleteStage(template)}
                            className="w-7 h-7 rounded-lg hover:bg-error-50 dark:hover:bg-error-500/15 flex items-center justify-center text-ink-400 hover:text-error-600 transition-colors sm:opacity-0 sm:group-hover/stage:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-error-50 dark:bg-error-500/15 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-error-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                Delete {deleteTarget?.type === 'group' ? 'group' : 'stage'} "{deleteTarget?.name}"?
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                {deleteTarget?.type === 'group'
                  ? 'All stages in this group will be removed. Tasks already created from these templates will keep their data.'
                  : 'This stage will be removed. Tasks already created from this template will keep their data.'}
              </p>
            </div>
          </div>
          {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={confirmDelete} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</Button>
          </div>
        </div>
      </Modal>

      {/* Add Group Modal */}
      <Modal open={showAddGroup} onClose={() => setShowAddGroup(false)} title="Create Task Group" size="md">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Group Name *</label>
            <input className="input" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. Album Designing" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Category</label>
            <select className="input" value={newGroupCategory} onChange={(e) => setNewGroupCategory(e.target.value)}>
              <option value="">Select category</option>
              <option>Wedding Photos</option>
              <option>Wedding Video</option>
              <option>Pre-Wedding</option>
              <option>Reels & Shorts</option>
            </select>
          </div>
          <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
            <p className="text-xs text-ink-600 dark:text-ink-300">After creating the group, you can add ordered stages like "Color Correction", "Layout Design", etc.</p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddGroup(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreateGroup} disabled={saving}>{saving ? 'Creating...' : 'Create Group'}</Button>
          </div>
        </div>
      </Modal>

      {/* Add Stage Modal */}
      <Modal open={!!showAddStage} onClose={() => { setShowAddStage(null); setNewStageName(''); setNewStageDesc(''); }} title={`Add Stage to "${showAddStage || ''}"`} size="md">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Stage Name *</label>
            <input className="input" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="e.g. Color Correction" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Description</label>
            <textarea className="input" rows={2} value={newStageDesc} onChange={(e) => setNewStageDesc(e.target.value)} placeholder="What does this stage involve?" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => { setShowAddStage(null); setNewStageName(''); setNewStageDesc(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => showAddStage && handleAddStage(showAddStage)} disabled={saving}>{saving ? 'Adding...' : 'Add Stage'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
