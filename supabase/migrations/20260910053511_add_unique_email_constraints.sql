-- Add unique constraints on email columns to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admins_email_key') THEN
    ALTER TABLE admins ADD CONSTRAINT admins_email_key UNIQUE (email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_email_key') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_email_key UNIQUE (email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_email_key') THEN
    ALTER TABLE customers ADD CONSTRAINT customers_email_key UNIQUE (email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;
