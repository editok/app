
INSERT INTO settings (key, value, updated_at)
VALUES ('dropdown_layout_designing', '["Magmod","Storybook","Premium","Magazene","Digital Magazine","Modern Album"]', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
