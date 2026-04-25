-- Phase 3 W3.5: extend OperationType enum so marketplace per-order sync
-- failures can be routed through FailedOperationsService.
ALTER TYPE "OperationType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_SYNC';
