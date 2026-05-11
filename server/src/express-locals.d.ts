import type {} from 'express-serve-static-core';

declare global {
  namespace Express {
    interface Locals {
      inspectorId: string;
      inspectorEmail: string;
    }
  }
}

export {};
