/*
# Seed Initial Data for EDITOK

## Overview
Seeds all tables with realistic initial data matching the existing mockData structures.
This includes customers, employees, task templates, sample projects with tasks,
and some notifications to demonstrate the workflow.

## Data Seeded
1. 7 customers (matching existing mock data)
2. 6 employees (matching existing mock data)  
3. 12 task templates (matching existing mock data)
4. 5 sample projects at various workflow stages with tasks
5. Sample notifications
*/

-- ============ CUSTOMERS ============
INSERT INTO customers (company, email, phone, gst, address, projects, status) VALUES
('Lens & Light Studios', 'contact@lenslight.com', '+91 98765 43210', '29ABCDE1234F1Z5', 'MG Road, Bengaluru, KA', 5, 'active'),
('Wedding Bells Photography', 'hello@weddingbells.in', '+91 90000 11111', '29WXYZ5678A1B2C3', 'Banjara Hills, Hyderabad, TS', 3, 'active'),
('Candid Moments', 'team@candidmoments.co', '+91 91234 56789', '29LMNOP9012D3E4F', 'Connaught Place, New Delhi, DL', 4, 'active'),
('Studio 24 Frames', 'info@studio24frames.com', '+91 99887 76655', '29QRSTU3456G5H6I', 'Bandra West, Mumbai, MH', 2, 'active'),
('Pixel Perfect Weddings', 'hello@pixelperfect.in', '+91 95555 12345', '29VWXYZ7890J7K8L', 'Anna Nagar, Chennai, TN', 6, 'active'),
('Golden Hour Films', 'contact@goldenhourfilms.in', '+91 94444 98765', '29ABCDEF1234M9N0P', 'Park Street, Kolkata, WB', 3, 'active'),
('Evergreen Photography', 'evergreen@photography.in', '+91 93333 22222', '29QRSTUV5678Q1R2S', 'Sector 17, Chandigarh, CH', 1, 'inactive')
ON CONFLICT DO NOTHING;

-- ============ EMPLOYEES ============
INSERT INTO employees (name, email, phone, skills, applications, experience, rating, projects, status, joined) VALUES
('Rahul Sharma', 'rahul@editok.com', '+91 90000 11111', ARRAY['Color Correction','Retouching','Album Design'], ARRAY['Lightroom','Photoshop','Luminar'], '5 years', 4.8, 42, 'working', '2024-01-15'),
('Priya Verma', 'priya@editok.com', '+91 90000 22222', ARRAY['Video Editing','Cinematic Grading','Motion Graphics'], ARRAY['Premiere Pro','After Effects','DaVinci Resolve'], '4 years', 4.9, 38, 'working', '2024-02-01'),
('Arjun Mehta', 'arjun@editok.com', '+91 90000 33333', ARRAY['Photo Selection','Album Layout','Color Grading'], ARRAY['Lightroom','Photoshop','InDesign'], '3 years', 4.7, 25, 'available', '2024-03-10'),
('Sneha Reddy', 'sneha@editok.com', '+91 90000 44444', ARRAY['Retouching','Skin Correction','Background Cleanup'], ARRAY['Photoshop','Luminar','Capture One'], '2 years', 4.6, 18, 'available', '2024-05-20'),
('Vikram Singh', 'vikram@editok.com', '+91 90000 55555', ARRAY['Video Editing','Sound Design','Color Grading'], ARRAY['Premiere Pro','DaVinci Resolve','Audition'], '6 years', 4.9, 55, 'working', '2023-11-05'),
('Ananya Gupta', 'ananya@editok.com', '+91 90000 66666', ARRAY['Album Design','Layout','Typography'], ARRAY['InDesign','Illustrator','Photoshop'], '3 years', 4.5, 20, 'leave', '2024-04-12')
ON CONFLICT DO NOTHING;

-- ============ TASK TEMPLATES ============
INSERT INTO task_templates (task, description, category, stage, priority, estimated_hours) VALUES
('Photo Selection & Culling', 'Review and select best photos from raw shoot', 'Photo Editing', 'Selection', 'high', 4),
('Color Correction', 'Apply consistent color grading across all selected photos', 'Photo Editing', 'Color Correction', 'high', 8),
('Retouching & Cleanup', 'Remove blemishes, smooth skin, clean backgrounds', 'Photo Editing', 'Retouching', 'medium', 12),
('Album Layout Design', 'Design album spreads with selected photos', 'Album Design', 'Layout Design', 'medium', 6),
('Cinematic Color Grading', 'Apply cinematic color grading to video footage', 'Video Editing', 'Color Correction', 'high', 10),
('Video Assembly & Cut', 'Assemble raw footage into coherent timeline', 'Video Editing', 'Editing', 'high', 8),
('Sound Design & Mix', 'Add background music and sync audio levels', 'Video Editing', 'Sound Design', 'medium', 4),
('Motion Graphics & Titles', 'Create animated titles and motion graphics', 'Video Editing', 'Motion Graphics', 'low', 6),
('Quality Check & Review', 'Final quality check before delivery', 'Quality Control', 'Quality Check', 'high', 2),
('Final Export & Delivery', 'Export final files in required formats', 'Delivery', 'Delivery', 'medium', 2),
('Highlight Reel Creation', 'Create 2-minute highlight reel from full video', 'Video Editing', 'Editing', 'medium', 6),
('Skin Tone Correction', 'Ensure consistent and natural skin tones', 'Photo Editing', 'Retouching', 'medium', 5)
ON CONFLICT DO NOTHING;

-- ============ SAMPLE PROJECTS ============
-- Project 1: In progress with tasks
INSERT INTO projects (order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, source_links, notes, created_by)
SELECT 'ORD-2026-001', 'Riya & Karan Wedding', c.id, 'contact@lenslight.com', 'Lens & Light Studios', 'Wedding Photo', 'Full Album', 'in-progress', 'high', '2026-08-20', '2026-07-15', 45000, 60, e.id, 'Rahul Sharma', 'Royal Romance', '40 pages', 1200, NULL, 'Cinematic', 'https://drive.google.com/source1', 'Customer wants warm tones with emphasis on golden hour shots', 'admin'
FROM customers c, employees e WHERE c.company = 'Lens & Light Studios' AND e.name = 'Rahul Sharma';

-- Project 2: Review stage
INSERT INTO projects (order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, source_links, notes, created_by)
SELECT 'ORD-2026-002', 'Aditi & Rohit Sangeet', c.id, 'hello@weddingbells.in', 'Wedding Bells Photography', 'Wedding Video', 'Highlight Reel', 'review', 'high', '2026-08-10', '2026-07-10', 35000, 80, e.id, 'Priya Verma', 'Bollywood Night', NULL, NULL, '4 hours', 'Cinematic', 'https://drive.google.com/source2', 'Focus on dance performances and candid moments', 'admin'
FROM customers c, employees e WHERE c.company = 'Wedding Bells Photography' AND e.name = 'Priya Verma';

-- Project 3: Assigned (available for editor to pick)
INSERT INTO projects (order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, source_links, notes, created_by)
SELECT 'ORD-2026-003', 'Meera & Vikram Reception', c.id, 'team@candidmoments.co', 'Candid Moments', 'Wedding Photo', 'Teaser + Album', 'assigned', 'medium', '2026-08-25', '2026-07-20', 38000, 0, e.id, 'Arjun Mehta', 'Garden Party', '30 pages', 800, NULL, 'Natural', 'https://drive.google.com/source3', 'Outdoor garden setting, natural light preferred', 'admin'
FROM customers c, employees e WHERE c.company = 'Candid Moments' AND e.name = 'Arjun Mehta';

-- Project 4: Correction stage
INSERT INTO projects (order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, source_links, notes, created_by)
SELECT 'ORD-2026-004', 'Sneha & Amit Engagement', c.id, 'info@studio24frames.com', 'Studio 24 Frames', 'Wedding Video', 'Full Film', 'correction', 'high', '2026-08-05', '2026-07-01', 55000, 75, e.id, 'Vikram Singh', 'Classic Elegance', NULL, NULL, '6 hours', 'Classic', 'https://drive.google.com/source4', 'Customer requested warmer color tones in outdoor scenes', 'admin'
FROM customers c, employees e WHERE c.company = 'Studio 24 Frames' AND e.name = 'Vikram Singh';

-- Project 5: Completed
INSERT INTO projects (order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, source_links, notes, created_by)
SELECT 'ORD-2026-005', 'Pooja & Raj Haldi Ceremony', c.id, 'hello@pixelperfect.in', 'Pixel Perfect Weddings', 'Wedding Photo', 'Full Album', 'completed', 'medium', '2026-07-30', '2026-07-01', 32000, 100, e.id, 'Sneha Reddy', 'Festive Yellow', '35 pages', 600, NULL, 'Vibrant', 'https://drive.google.com/source5', 'Bright vibrant colors for Haldi ceremony', 'admin'
FROM customers c, employees e WHERE c.company = 'Pixel Perfect Weddings' AND e.name = 'Sneha Reddy';

-- Project 6: Created (new, from customer)
INSERT INTO projects (order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, started_date, amount, progress, theme, album_size, photos, duration, editing_style, source_links, notes, created_by)
SELECT 'ORD-2026-006', 'Ananya & Karthik Wedding', c.id, 'contact@goldenhourfilms.in', 'Golden Hour Films', 'Wedding Video', 'Highlight + Full Film', 'created', 'medium', '2026-09-15', '2026-08-05', 65000, 0, 'Sunset Golden', NULL, 500, '5 hours', 'Cinematic', 'https://drive.google.com/source6', 'Customer wants golden hour emphasis and drone shots', 'customer'
FROM customers c WHERE c.company = 'Golden Hour Films';

-- ============ TASKS ============
-- Tasks for Project 1 (in-progress)
INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status)
SELECT p.id, 'Photo Selection & Culling', 'Review and select best photos from raw shoot', 'Selection', 'high', 4, e.id, 'Rahul Sharma', 1, 'approved'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-001' AND e.name = 'Rahul Sharma';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Color Correction', 'Apply consistent color grading across all selected photos', 'Color Correction', 'high', 8, e.id, 'Rahul Sharma', 2, 'approved', now()
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-001' AND e.name = 'Rahul Sharma';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status)
SELECT p.id, 'Retouching & Cleanup', 'Remove blemishes, smooth skin, clean backgrounds', 'Retouching', 'medium', 12, e.id, 'Rahul Sharma', 3, 'in-progress'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-001' AND e.name = 'Rahul Sharma';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status)
SELECT p.id, 'Album Layout Design', 'Design album spreads with selected photos', 'Layout Design', 'medium', 6, e.id, 'Rahul Sharma', 4, 'pending'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-001' AND e.name = 'Rahul Sharma';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status)
SELECT p.id, 'Quality Check & Review', 'Final quality check before delivery', 'Quality Check', 'high', 2, e.id, 'Rahul Sharma', 5, 'pending'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-001' AND e.name = 'Rahul Sharma';

-- Tasks for Project 2 (review - all tasks approved)
INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Video Assembly & Cut', 'Assemble raw footage into coherent timeline', 'Editing', 'high', 8, e.id, 'Priya Verma', 1, 'approved', now() - interval '3 days'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-002' AND e.name = 'Priya Verma';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Cinematic Color Grading', 'Apply cinematic color grading to video footage', 'Color Correction', 'high', 10, e.id, 'Priya Verma', 2, 'approved', now() - interval '2 days'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-002' AND e.name = 'Priya Verma';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Sound Design & Mix', 'Add background music and sync audio levels', 'Sound Design', 'medium', 4, e.id, 'Priya Verma', 3, 'approved', now() - interval '1 day'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-002' AND e.name = 'Priya Verma';

-- Tasks for Project 3 (assigned - pending)
INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status)
SELECT p.id, 'Photo Selection & Culling', 'Review and select best photos from raw shoot', 'Selection', 'high', 4, e.id, 'Arjun Mehta', 1, 'pending'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-003' AND e.name = 'Arjun Mehta';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status)
SELECT p.id, 'Color Correction', 'Apply consistent color grading across all selected photos', 'Color Correction', 'high', 8, e.id, 'Arjun Mehta', 2, 'pending'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-003' AND e.name = 'Arjun Mehta';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status)
SELECT p.id, 'Album Layout Design', 'Design album spreads with selected photos', 'Layout Design', 'medium', 6, e.id, 'Arjun Mehta', 3, 'pending'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-003' AND e.name = 'Arjun Mehta';

-- Tasks for Project 4 (correction)
INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Video Assembly & Cut', 'Assemble raw footage into coherent timeline', 'Editing', 'high', 8, e.id, 'Vikram Singh', 1, 'approved', now() - interval '5 days'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-004' AND e.name = 'Vikram Singh';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Cinematic Color Grading', 'Apply cinematic color grading to video footage', 'Color Correction', 'high', 10, e.id, 'Vikram Singh', 2, 'approved', now() - interval '3 days'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-004' AND e.name = 'Vikram Singh';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status)
SELECT p.id, 'Sound Design & Mix', 'Add background music and sync audio levels', 'Sound Design', 'medium', 4, e.id, 'Vikram Singh', 3, 'in-progress'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-004' AND e.name = 'Vikram Singh';

-- Tasks for Project 5 (completed - all approved)
INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Photo Selection & Culling', 'Review and select best photos from raw shoot', 'Selection', 'high', 4, e.id, 'Sneha Reddy', 1, 'approved', now() - interval '10 days'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-005' AND e.name = 'Sneha Reddy';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Color Correction', 'Apply consistent color grading across all selected photos', 'Color Correction', 'high', 8, e.id, 'Sneha Reddy', 2, 'approved', now() - interval '7 days'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-005' AND e.name = 'Sneha Reddy';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Retouching & Cleanup', 'Remove blemishes, smooth skin, clean backgrounds', 'Retouching', 'medium', 12, e.id, 'Sneha Reddy', 3, 'approved', now() - interval '3 days'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-005' AND e.name = 'Sneha Reddy';

INSERT INTO tasks (project_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, sequence, status, approved_at)
SELECT p.id, 'Album Layout Design', 'Design album spreads with selected photos', 'Layout Design', 'medium', 6, e.id, 'Sneha Reddy', 4, 'approved', now() - interval '1 day'
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-005' AND e.name = 'Sneha Reddy';

-- ============ REVIEW FILES ============
-- Review files for Project 2 (review stage)
INSERT INTO review_files (project_id, file_type, file_url, file_name, version, uploaded_by)
SELECT id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'Highlight Reel V1.mp4', 1, 'admin'
FROM projects WHERE order_number = 'ORD-2026-002';

-- Review files for Project 4 (correction stage)
INSERT INTO review_files (project_id, file_type, file_url, file_name, version, uploaded_by)
SELECT id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'Engagement Film V1.mp4', 1, 'admin'
FROM projects WHERE order_number = 'ORD-2026-004';

INSERT INTO review_files (project_id, file_type, file_url, file_name, version, uploaded_by)
SELECT id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'Engagement Film V2.mp4', 2, 'admin'
FROM projects WHERE order_number = 'ORD-2026-004';

-- ============ CORRECTIONS ============
-- Correction for Project 4
INSERT INTO corrections (number, project_id, order_id, event_name, customer, customer_email, editor, editor_id, photo_marks, video_timestamps, voice_notes, status, priority, due_date)
SELECT 'COR-001', p.id, 'ORD-2026-004', 'Sneha & Amit Engagement', 'Studio 24 Frames', 'info@studio24frames.com', 'Vikram Singh', e.id,
'[{"id":"m1","label":"Photo 1","comment":"Skin tones look too orange in outdoor scenes","x":45,"y":30},{"id":"m2","label":"Photo 2","comment":"Background needs cleanup on left side","x":60,"y":55}]'::jsonb,
'[{"id":"t1","time":120,"timeFormatted":"02:00","comment":"Music transition is too abrupt here"},{"id":"t2","time":345,"timeFormatted":"05:45","comment":"Can we add a slow-motion effect at this moment?"}]'::jsonb,
'[]'::jsonb,
'pending', 'high', CURRENT_DATE + 3
FROM projects p, employees e WHERE p.order_number = 'ORD-2026-004' AND e.name = 'Vikram Singh';

-- ============ NOTIFICATIONS ============
INSERT INTO notifications (type, title, description, target_role, read) VALUES
('project', 'New project created', 'Customer "Golden Hour Films" has submitted a new project: Ananya & Karthik Wedding', 'admin', false),
('task-complete', 'Task submitted for review', 'Rahul Sharma submitted "Retouching & Cleanup" for approval', 'admin', false),
('approval', 'Task approved', 'Admin approved "Color Correction" - you can proceed to next task', 'editor', false),
('correction', 'New correction request', 'Customer requested corrections on "Sneha & Amit Engagement"', 'admin', false),
('correction', 'Correction assigned', 'You have a correction to resolve on "Sneha & Amit Engagement"', 'editor', false),
('project', 'Project status update', 'Your project "Riya & Karan Wedding" is now 60% complete', 'customer', false)
ON CONFLICT DO NOTHING;

-- ============ PAYMENTS ============
INSERT INTO payments (project_id, amount, status, paid_at)
SELECT id, 32000, 'paid', now() - interval '2 days' FROM projects WHERE order_number = 'ORD-2026-005';

INSERT INTO payments (project_id, amount, status)
SELECT id, 45000, 'pending' FROM projects WHERE order_number = 'ORD-2026-001';

INSERT INTO payments (project_id, amount, status)
SELECT id, 35000, 'pending' FROM projects WHERE order_number = 'ORD-2026-002';