-- GRACE — Admin Dashboard WorkOS: Task Board "Under Review" column
-- Migration: 041_task_board_under_review.sql
--
-- The WorkOS spec's Task Board requires five columns: To Do, In Progress,
-- Blocked, Under Review, Completed. work_order_tasks (migration 034)
-- shipped without 'under_review' — an oversight caught while building the
-- Task Board UI. Widening the CHECK constraint; no existing rows are
-- affected (idempotent, additive only).

ALTER TABLE work_order_tasks DROP CONSTRAINT IF EXISTS work_order_tasks_status_check;
ALTER TABLE work_order_tasks ADD CONSTRAINT work_order_tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'blocked', 'under_review', 'completed', 'cancelled'));

COMMENT ON COLUMN work_order_tasks.status IS
  'Task Board column. pending=To Do, in_progress=In Progress, blocked=Blocked, under_review=Under Review, completed=Completed, cancelled=hidden from the board by default.';
