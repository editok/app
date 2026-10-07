import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../contexts/AuthContext';

const STORAGE_KEYS = {
  photoSubcategories: 'dropdown_photo_subcategories',
  videoSubcategories: 'dropdown_video_subcategories',
  albumSizes: 'dropdown_album_sizes',
  editingStyles: 'dropdown_editing_styles',
  layoutDesigning: 'dropdown_layout_designing',
  priorities: 'dropdown_priorities',
} as const;

export type DropdownKey = keyof typeof STORAGE_KEYS;

const DEFAULTS: Record<DropdownKey, string[]> = {
  photoSubcategories: ['Full Album', 'Highlight Reel', 'Teaser + Album', 'Premium Album'],
  videoSubcategories: ['Highlight Reel', 'SDE (Same Day Edit)', 'Teaser', 'Highlight + Full Film', 'Cinematic Trailer'],
  albumSizes: ['12x36 (30 spreads)', '10x20 (20 spreads)', '8x12 (15 spreads)', '40 pages', '30 pages'],
  editingStyles: ['Cinematic', 'Documentary', 'Traditional', 'Modern', 'Natural', 'Classic', 'Vibrant'],
  layoutDesigning: ['Magmod', 'Storybook', 'Premium', 'Magazene', 'Digital Magazine', 'Modern Album'],
  priorities: ['Low', 'Medium', 'High', 'Urgent'],
};

export function useDropdownOptions() {
  const [options, setOptions] = useState<Record<DropdownKey, string[]>>(DEFAULTS);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', Object.values(STORAGE_KEYS));
      if (!active || !data) return;
      const next = { ...DEFAULTS };
      for (const row of data) {
        const key = Object.keys(STORAGE_KEYS).find((k) => STORAGE_KEYS[k as DropdownKey] === row.key) as DropdownKey | undefined;
        if (key && Array.isArray(row.value)) {
          next[key] = row.value as string[];
        }
      }
      setOptions(next);
    };

    load();

    const channel = supabase
      .channel('dropdown-options-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => load())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const addOption = useCallback(async (key: DropdownKey, option: string) => {
    const trimmed = option.trim();
    if (!trimmed) return;
    setOptions((prev) => {
      if (prev[key].includes(trimmed)) return prev;
      const next = { ...prev, [key]: [...prev[key], trimmed] };
      if (supabase) {
        supabase.from('settings').upsert(
          { key: STORAGE_KEYS[key], value: next[key], updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        ).then();
      }
      return next;
    });
  }, []);

  const deleteOption = useCallback(async (key: DropdownKey, option: string) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: prev[key].filter((o) => o !== option) };
      if (supabase) {
        supabase.from('settings').upsert(
          { key: STORAGE_KEYS[key], value: next[key], updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        ).then();
      }
      return next;
    });
  }, []);

  return { options, addOption, deleteOption };
}
