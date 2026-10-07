import { useState } from 'react';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Modal from '../components/ui/Modal';
import { Check, ChevronRight, ChevronLeft, Upload, Music, Link2, FileText, Sparkles, Plus, Trash2, ChevronDown, Camera, Video, AlertCircle } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSound } from '../contexts/SoundContext';
import { useCustomers } from '../hooks/useData';
import { useDropdownOptions, DropdownKey } from '../hooks/useDropdownOptions';
import * as db from '../data/db';

const steps = ['Customer & Category', 'Project Details', 'Source Links', 'Review'];

type CategoryType = 'photo' | 'video';

interface SourceLinkEntry {
  url: string;
  description: string;
}

export default function NewProject({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { role, user } = useAuth();
  const { play: playSound } = useSound();
  const { customers } = useCustomers();
  const { options, addOption, deleteOption } = useDropdownOptions();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer: '', customerId: '', categoryType: '' as CategoryType | '', subcategory: '', deadline: '', priority: 'Medium',
    theme: '', albumSize: '', photos: '', duration: '', editingStyle: '', layoutDesign: '',
    uploadLinks: '', musicLinks: '', referenceLinks: '', notes: '',
    autoGenerate: false,
  });
  const [sourceLinks, setSourceLinks] = useState<SourceLinkEntry[]>([{ url: '', description: '' }]);
  const [musicLinkList, setMusicLinkList] = useState<string[]>(['']);

  const update = (key: string, val: string | boolean | string[]) => setForm((f) => ({ ...f, [key]: val }));

  const addSourceLink = () => { setSourceLinks((prev) => [...prev, { url: '', description: '' }]); playSound('add'); };
  const removeSourceLink = (index: number) => { setSourceLinks((prev) => prev.filter((_, i) => i !== index)); playSound('remove'); };
  const updateSourceLink = (index: number, field: keyof SourceLinkEntry, value: string) =>
    setSourceLinks((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));

  const serializeSourceLinks = (): string => {
    const valid = sourceLinks.filter((e) => e.url.trim());
    if (valid.length === 0) return '';
    return JSON.stringify(valid);
  };

  const serializeMusicLinks = (): string => {
    const valid = musicLinkList.filter((l) => l.trim());
    if (valid.length === 0) return '';
    if (valid.length === 1) return valid[0];
    return JSON.stringify(valid.map((url) => ({ url, description: '' })));
  };

  const addMusicLink = () => { setMusicLinkList((prev) => [...prev, '']); playSound('add'); };
  const removeMusicLink = (index: number) => { setMusicLinkList((prev) => prev.filter((_, i) => i !== index)); playSound('remove'); };
  const updateMusicLink = (index: number, value: string) => setMusicLinkList((prev) => prev.map((l, i) => (i === index ? value : l)));

  const isVideo = form.categoryType === 'video';
  const isPhoto = form.categoryType === 'photo';
  const isAlbumDesigning = isPhoto && form.subcategory.toLowerCase().includes('album');

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.categoryType) return 'Please select a category (Photo or Video).';
      if (!form.subcategory) return 'Please select a subcategory.';
      if (!form.deadline) return 'Please select a deadline.';
      if (role === 'admin' && !form.customer) return 'Please select a customer.';
    }
    if (step === 1) {
      if (!form.theme.trim()) return 'Please enter a Project Title.';
      if (isPhoto && !form.albumSize) return 'Please select an Album Size.';
      if (isPhoto && !form.photos) return 'Please enter the Number of Photos.';
      if (isVideo && !form.duration) return 'Please enter a Duration.';
      if (isAlbumDesigning && !form.layoutDesign) return 'Please select a Layout Designing option for album designing.';
    }
    if (step === 2) {
      if (sourceLinks.filter((e) => e.url.trim()).length === 0) return 'Please add at least one Source Link.';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setError(err); playSound('error'); return; }
    setError(null);
    playSound('step');
    setStep(step + 1);
  };

  const handleCreate = async () => {
    const missing: string[] = [];
    if (!form.categoryType) missing.push('Category');
    if (!form.subcategory) missing.push('Subcategory');
    if (!form.deadline) missing.push('Deadline');
    if (role === 'admin' && !form.customer) missing.push('Customer');
    if (!form.theme.trim()) missing.push('Project Title');
    if (isPhoto && !form.albumSize) missing.push('Album Size');
    if (isPhoto && !form.photos) missing.push('Number of Photos');
    if (isVideo && !form.duration) missing.push('Duration');
    if (isVideo && !form.editingStyle) missing.push('Editing Style');
    if (isAlbumDesigning && !form.layoutDesign) missing.push('Layout Designing');
    if (sourceLinks.filter((e) => e.url.trim()).length === 0) missing.push('Source Links');
    if (missing.length > 0) {
      setError(`Please fill in all mandatory fields before submitting: ${missing.join(', ')}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const customer = role === 'admin' ? customers.find((c) => c.company === form.customer) : null;
      const customerName = role === 'admin' ? form.customer : (user?.user_metadata?.full_name || user?.email || 'Customer');
      const customerEmail = role === 'admin' ? (customer?.email || null) : (user?.email || null);
      const orderNumber = await db.generateOrderNumber(form.categoryType);
      const categoryLabel = isVideo ? 'Wedding Video' : 'Wedding Photo';
      const project = await db.createProject({
        order_number: orderNumber,
        event_name: form.theme || `${customerName} - ${categoryLabel}`,
        customer_id: customer?.id || null,
        customer_email: customerEmail,
        customer_name: customerName,
        category: categoryLabel,
        subcategory: form.subcategory || null,
        status: 'created',
        priority: form.priority.toLowerCase(),
        deadline: form.deadline || null,
        amount: 0,
        progress: 0,
        theme: form.theme || null,
        album_size: form.albumSize || null,
        photos: form.photos ? parseInt(form.photos) : null,
        duration: form.duration || null,
        editing_style: isVideo ? (form.editingStyle || null) : null,
        layout_design: isAlbumDesigning ? (form.layoutDesign || null) : null,
        source_links: serializeSourceLinks() || null,
        upload_links: form.uploadLinks || null,
        music_links: isVideo ? (serializeMusicLinks() || null) : null,
        reference_links: form.referenceLinks || null,
        notes: form.notes || null,
        created_by: role || 'admin',
      });

      if (!project) throw new Error('Failed to create project');

      if (form.autoGenerate && role === 'admin') {
        const templates = await db.fetchTaskTemplates();
        const categoryTemplates = templates.filter((t) =>
          t.category === categoryLabel || (isVideo && t.category === 'Wedding Video') || (isPhoto && t.category === 'Wedding Photos')
        );
        for (let i = 0; i < categoryTemplates.length; i++) {
          const t = categoryTemplates[i];
          await db.createTask({
            project_id: project.id,
            template_id: t.id,
            task_name: t.task,
            description: t.description,
            stage: t.stage,
            priority: t.priority.toLowerCase(),
            estimated_hours: t.estimated_hours,
            assigned_to: null,
            assigned_to_name: null,
            sequence: i + 1,
            status: 'pending',
          });
        }
      }

      await db.createNotification({
        type: 'new-order',
        title: 'New Project Ready for Assignment',
        description: `${customerName} - ${categoryLabel} project "${form.theme || 'Untitled'}" has been created and is awaiting approval.`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      await db.sendStatusEmail({
        templateName: 'order_confirmation',
        recipient: customerEmail,
        recipientName: customerName,
        variables: {
          customer_name: customerName,
          order_number: project.order_number || '',
          project_name: project.event_name || '',
          category: categoryLabel,
          photo_count: form.photos || form.duration || '',
          deadline: form.deadline || '',
        },
      });
      await db.sendStatusEmail({
        templateName: 'admin_new_order',
        recipient: 'support@editok.in',
        recipientName: 'EDITOK Admin',
        variables: {
          order_number: project.order_number || '',
          project_name: project.event_name || '',
          customer_name: customerName,
          category: categoryLabel,
          photo_count: form.photos || form.duration || '',
          deadline: form.deadline || '',
        },
      });

      const home = role === 'customer' ? 'customer-dashboard' : 'admin-dashboard';
      onNavigate(home);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const validSourceLinks = sourceLinks.filter((e) => e.url.trim());

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', onClick: () => onNavigate(role === 'customer' ? 'customer-dashboard' : 'admin-dashboard') }, { label: 'New Project' }]} />

      {error && (
        <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 dark:border-error-500/30 text-sm text-error-700 dark:text-error-400">
          {error}
        </div>
      )}

      <Card className="animate-slide-up">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < step ? 'bg-success-500 text-white' : i === step ? 'bg-primary-600 text-white ring-4 ring-primary-100' : 'bg-ink-100 dark:bg-ink-800 text-ink-400 dark:text-ink-500'
                }`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <p className={`text-xs font-semibold mt-2 hidden sm:block ${i <= step ? 'text-ink-700 dark:text-ink-200' : 'text-ink-400 dark:text-ink-500'}`}>{s}</p>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${i < step ? 'bg-success-300' : 'bg-ink-200 dark:bg-ink-700'}`} />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {role === 'admin' ? (
              <Field label="Customer" required>
                <select className="input" value={form.customer} onChange={(e) => {
                  const c = customers.find((c) => c.company === e.target.value);
                  update('customer', e.target.value);
                  update('customerId', c?.id || '');
                  playSound('select');
                }}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.company}>{c.company}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Customer" required>
                <input className="input bg-ink-50 dark:bg-ink-800" value={user?.user_metadata?.full_name || user?.email || ''} disabled readOnly />
              </Field>
            )}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 flex items-center gap-1.5">
                Category <span className="text-error-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { update('categoryType', 'photo'); update('subcategory', ''); setMusicLinkList(['']); playSound('select'); }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    isPhoto
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 shadow-soft'
                      : 'border-ink-200 dark:border-ink-700 hover:border-primary-300 text-ink-600 dark:text-ink-300'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform ${isPhoto ? 'bg-primary-600 text-white scale-110' : 'bg-ink-100 dark:bg-ink-800 text-ink-400'}`}>
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Photo</p>
                    <p className="text-xs text-ink-400 dark:text-ink-500">Album design, editing</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { update('categoryType', 'video'); update('subcategory', ''); playSound('select'); }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    isVideo
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 shadow-soft'
                      : 'border-ink-200 dark:border-ink-700 hover:border-primary-300 text-ink-600 dark:text-ink-300'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform ${isVideo ? 'bg-primary-600 text-white scale-110' : 'bg-ink-100 dark:bg-ink-800 text-ink-400'}`}>
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Video</p>
                    <p className="text-xs text-ink-400 dark:text-ink-500">Films, reels, highlights</p>
                  </div>
                </button>
              </div>
            </div>
            <EditableSelect
              label="Subcategory"
              required
              editable={role === 'admin'}
              value={form.subcategory}
              options={isPhoto ? options.photoSubcategories : isVideo ? options.videoSubcategories : []}
              disabled={!form.categoryType}
              onChange={(val) => update('subcategory', val)}
              onAdd={(newOption) => addOption(isPhoto ? 'photoSubcategories' : 'videoSubcategories', newOption)}
              onDelete={(option) => deleteOption(isPhoto ? 'photoSubcategories' : 'videoSubcategories', option)}
            />
            <Field label="Deadline" required>
              <input type="date" className="input" min={new Date().toISOString().slice(0, 10)} value={form.deadline} onChange={(e) => update('deadline', e.target.value)} />
            </Field>
            <EditableSelect
              label="Priority"
              editable={role === 'admin'}
              value={form.priority}
              options={options.priorities}
              onChange={(val) => update('priority', val)}
              onAdd={(newOption) => addOption('priorities', newOption)}
              onDelete={(option) => deleteOption('priorities', option)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <Field label="Project Title" required>
              <input className="input" placeholder="e.g. Riya & Karan Wedding" value={form.theme} onChange={(e) => update('theme', e.target.value)} />
            </Field>
            {isPhoto && (
              <>
                <EditableSelect
                  label="Album Size"
                  required
                  editable={role === 'admin'}
                  value={form.albumSize}
                  options={options.albumSizes}
                  onChange={(val) => update('albumSize', val)}
                  onAdd={(newOption) => addOption('albumSizes', newOption)}
                  onDelete={(option) => deleteOption('albumSizes', option)}
                />
                <Field label="Number of Photos" required>
                  <input type="number" className="input" placeholder="e.g. 800" value={form.photos} onChange={(e) => update('photos', e.target.value)} />
                </Field>
              </>
            )}
            {isVideo && (
              <Field label="Duration" required>
                <input className="input" placeholder="e.g. 30 min" value={form.duration} onChange={(e) => update('duration', e.target.value)} />
              </Field>
            )}
            {isVideo && (
              <EditableSelect
                label="Editing Style"
                editable={role === 'admin'}
                value={form.editingStyle}
                options={options.editingStyles}
                onChange={(val) => update('editingStyle', val)}
                onAdd={(newOption) => addOption('editingStyles', newOption)}
                onDelete={(option) => deleteOption('editingStyles', option)}
                required
              />
            )}
            {isAlbumDesigning && (
              <EditableSelect
                label="Layout Designing"
                editable={role === 'admin'}
                value={form.layoutDesign}
                options={options.layoutDesigning}
                onChange={(val) => update('layoutDesign', val)}
                onAdd={(newOption) => addOption('layoutDesigning', newOption)}
                onDelete={(option) => deleteOption('layoutDesigning', option)}
                required
              />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 max-w-2xl">
            <Field label="Source Links (Google Drive, Dropbox)" required icon={<Link2 className="w-4 h-4" />}>
              <div className="space-y-3">
                {sourceLinks.map((entry, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center animate-slide-up">
                    <input
                      className="input flex-1"
                      placeholder="Paste link URL..."
                      value={entry.url}
                      onChange={(e) => updateSourceLink(index, 'url', e.target.value)}
                    />
                    <input
                      className="input flex-1"
                      placeholder="Description (e.g. Raw photos)"
                      value={entry.description}
                      onChange={(e) => updateSourceLink(index, 'description', e.target.value)}
                    />
                    {sourceLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSourceLink(index)}
                        className="p-2 rounded-lg text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors flex-shrink-0"
                        aria-label="Remove link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSourceLink}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add another link
                </button>
              </div>
            </Field>
            {role === 'admin' && (
              <Field label="Upload Links" icon={<Upload className="w-4 h-4" />}>
                <input className="input" placeholder="Upload destination link" value={form.uploadLinks} onChange={(e) => update('uploadLinks', e.target.value)} />
              </Field>
            )}
            {isVideo && (
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 flex items-center gap-1.5">
                  <Music className="w-4 h-4" /> Music Links
                </label>
                <div className="space-y-2">
                  {musicLinkList.map((link, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className="input" placeholder={`Music track link ${i + 1}`} value={link} onChange={(e) => updateMusicLink(i, e.target.value)} />
                      {musicLinkList.length > 1 && (
                        <button type="button" onClick={() => removeMusicLink(i)} className="p-2 rounded-lg text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addMusicLink} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add another music link
                  </button>
                </div>
              </div>
            )}
            <Field label="Reference Links" icon={<FileText className="w-4 h-4" />}>
              <input className="input" placeholder="Reference album/video links" value={form.referenceLinks} onChange={(e) => update('referenceLinks', e.target.value)} />
            </Field>
            <Field label="Notes">
              <textarea className="input" rows={3} placeholder="Additional notes..." value={form.notes} onChange={(e) => update('notes', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl space-y-4">
            {role === 'admin' && (
              <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800 flex items-center justify-between animate-slide-up">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-primary-600" />
                  <div>
                    <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Auto-generate tasks from template</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">Creates unassigned task templates — you will assign editors after reviewing the project</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.autoGenerate} onChange={(e) => { update('autoGenerate', e.target.checked); playSound(e.target.checked ? 'toggle-on' : 'toggle-off'); }} className="sr-only peer" />
                  <div className="w-11 h-6 bg-ink-200 dark:bg-ink-700 peer-focus:ring-2 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                </label>
              </div>
            )}

            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-ink-100 dark:border-ink-800 animate-slide-up hover:-translate-y-0.5 transition-transform">
              <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Review Summary</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <span className="text-ink-500 dark:text-ink-400">Customer:</span><span className="font-medium text-ink-700 dark:text-ink-200">{form.customer || '—'}</span>
                <span className="text-ink-500 dark:text-ink-400">Category:</span><span className="font-medium text-ink-700 dark:text-ink-200 capitalize">{form.categoryType || '—'}</span>
                <span className="text-ink-500 dark:text-ink-400">Subcategory:</span><span className="font-medium text-ink-700 dark:text-ink-200">{form.subcategory || '—'}</span>
                <span className="text-ink-500 dark:text-ink-400">Deadline:</span><span className="font-medium text-ink-700 dark:text-ink-200">{form.deadline || '—'}</span>
                <span className="text-ink-500 dark:text-ink-400">Priority:</span><span className="font-medium text-ink-700 dark:text-ink-200">{form.priority}</span>
              </div>
              {validSourceLinks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ink-200 dark:border-ink-700">
                  <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2">Source Links:</p>
                  <div className="space-y-1">
                    {validSourceLinks.map((link, i) => (
                      <div key={i} className="text-xs text-ink-600 dark:text-ink-300">
                        <span className="font-medium">{link.description || `Link ${i + 1}`}:</span>{' '}
                        <span className="text-primary-600 truncate">{link.url}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-ink-100 dark:border-ink-800">
          <Button variant="outline" icon={<ChevronLeft className="w-4 h-4" />} onClick={() => { setError(null); if (step > 0) { playSound('back'); setStep(step - 1); } }} disabled={step === 0}>
            Previous
          </Button>
          {step < steps.length - 1 ? (
            <Button variant="primary" iconRight={<ChevronRight className="w-4 h-4" />} onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button variant="success" icon={<Check className="w-4 h-4" />} onClick={handleCreate} loading={saving}>
              Create Project
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, required, icon }: { label: string; children: React.ReactNode; required?: boolean; icon?: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 flex items-center gap-1.5">
        {icon}
        {label}
        {required && <span className="text-error-500">*</span>}
      </label>
      {children}
    </div>
  );
}

interface EditableSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  onAdd?: (newOption: string) => void;
  onDelete?: (option: string) => void;
  required?: boolean;
  disabled?: boolean;
  editable?: boolean;
}

function EditableSelect({ label, value, options, onChange, onAdd, onDelete, required, disabled, editable = true }: EditableSelectProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [newOption, setNewOption] = useState('');
  const { play: playSound } = useSound();

  const handleAdd = () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    if (onAdd) onAdd(trimmed);
    onChange(trimmed);
    setNewOption('');
    setShowAdd(false);
  };

  const handleDelete = (option: string) => {
    if (onDelete) onDelete(option);
    if (value === option) onChange('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 flex items-center gap-1.5">
          {label}
          {required && <span className="text-error-500">*</span>}
        </label>
        {editable && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => { setShowAdd(true); playSound('click'); }}
              className="p-1 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors"
              aria-label={`Add ${label}`}
              disabled={disabled}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setShowDelete(!showDelete); playSound('click'); }}
              className="p-1 rounded-lg text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors"
              aria-label={`Delete ${label} option`}
              disabled={disabled || options.length === 0}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="relative">
        <select
          className="input appearance-none pr-9"
          value={value}
          onChange={(e) => { onChange(e.target.value); playSound('select'); }}
          disabled={disabled}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
      </div>
      {showDelete && (
        <div className="mt-2 flex flex-wrap gap-1.5 animate-slide-up">
          {options.map((o) => (
            <span key={o} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-ink-50 dark:bg-ink-800 text-xs text-ink-600 dark:text-ink-300">
              {o}
              <button
                type="button"
                onClick={() => handleDelete(o)}
                className="text-error-500 hover:text-error-600 transition-colors"
                aria-label={`Remove ${o}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setShowDelete(false)}
            className="text-xs text-primary-600 font-semibold ml-1"
          >
            Done
          </button>
        </div>
      )}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`Add ${label} Option`} size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">New {label} Name</label>
            <input
              className="input"
              placeholder={`Enter new ${label.toLowerCase()}...`}
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAdd} disabled={!newOption.trim()}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export type { DropdownKey };
