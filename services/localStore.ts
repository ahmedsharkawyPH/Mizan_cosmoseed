import { mizanDb } from './mizanDb';
import { 
  OutboxItem, 
  SyncError, 
  LocalSnapshot, 
  TABLES_TO_SYNC, 
  SyncTableName,
  OutboxStatus
} from './dbTypes';

export type { OutboxItem, SyncError, LocalSnapshot };

export class LocalStore {
  async init() {
    if (!mizanDb.isOpen()) {
      await mizanDb.open();
    }
  }

  /**
   * Loads a complete snapshot of the local database.
   * Uses a read-only transaction to ensure consistency.
   */
  async loadAll(): Promise<LocalSnapshot> {
    await this.init();
    
    return await mizanDb.transaction('r', mizanDb.tables, async () => {
      const result: any = {};
      
      for (const table of TABLES_TO_SYNC) {
        result[table] = await (mizanDb as any)[table].toArray();
      }
      
      const settingsRow = await mizanDb.settings.get('main');
      result.settings = settingsRow ? settingsRow.value : null;
      
      result.outbox = await mizanDb.outbox.orderBy('id').toArray();
      
      return result as LocalSnapshot;
    });
  }

  /**
   * Safely saves a snapshot to the local database.
   * Uses an atomic transaction. If any bulkAdd fails, the entire operation rolls back,
   * preserving the previous state of the database.
   */
  async saveAll(data: Partial<LocalSnapshot>) {
    await this.init();
    
    // We only lock the tables that are present in the data object to improve performance
    const tablesToLock = Object.keys(data)
      .filter(k => k !== 'settings')
      .map(k => k === 'outbox' ? 'outbox' : k);
    
    if (data.settings) tablesToLock.push('settings');

    return await mizanDb.transaction('rw', tablesToLock, async () => {
      for (const key of Object.keys(data)) {
        const table = key as keyof LocalSnapshot;
        const tableData = data[table];

        if (table === 'settings') {
          await mizanDb.settings.put({ id: 'main', value: tableData });
        } else if (table === 'outbox') {
          await mizanDb.outbox.clear();
          if (Array.isArray(tableData)) {
            await mizanDb.outbox.bulkAdd(tableData);
          }
        } else if ((mizanDb as any)[table]) {
          const dexieTable = (mizanDb as any)[table];
          
          // Validation before clearing: ensure we have an array
          if (!Array.isArray(tableData)) {
            throw new Error(`Invalid data format for table ${table}: expected array.`);
          }

          // Atomic clear and add
          await dexieTable.clear();
          await dexieTable.bulkAdd(tableData);
        }
      }
    });
  }

  async upsert(table: string, item: any) {
    await this.init();
    if (table === 'settings') {
      await mizanDb.settings.put({ id: 'main', value: item });
    } else if ((mizanDb as any)[table]) {
      await (mizanDb as any)[table].put(item);
    }
  }

  async delete(table: string, id: string) {
    await this.init();
    if ((mizanDb as any)[table]) {
      await (mizanDb as any)[table].delete(id);
    }
  }

  /**
   * Adds an item to the outbox with enhanced metadata.
   */
  async addToOutbox(item: Omit<OutboxItem, 'createdAt' | 'updatedAt' | 'attempts' | 'status'>) {
    await this.init();
    const now = new Date().toISOString();
    const outboxItem: OutboxItem = {
      ...item,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      status: 'pending'
    };
    return await mizanDb.outbox.add(outboxItem);
  }

  async updateOutboxItem(id: number, patch: Partial<OutboxItem>) {
    await this.init();
    const updatePatch = {
      ...patch,
      updatedAt: new Date().toISOString()
    };
    return await mizanDb.outbox.update(id, updatePatch);
  }

  /**
   * Calculates exponential backoff delay in milliseconds.
   */
  calculateBackoff(attempts: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30 * 60 * 1000; // 30 minutes
    const delay = baseDelay * Math.pow(2, attempts);
    return Math.min(delay, maxDelay);
  }

  async markOutboxAsSent(id: number) {
    await this.init();
    // We can either delete or mark as sent. Deleting keeps DB small.
    await mizanDb.outbox.delete(id);
  }

  async getOutbox(): Promise<OutboxItem[]> {
    await this.init();
    return await mizanDb.outbox.orderBy('id').toArray();
  }

  async removeFromOutbox(id: number) {
    await this.init();
    await mizanDb.outbox.delete(id);
  }

  /**
   * Logs a synchronization error with full context.
   */
  async logError(params: {
    entityType: string;
    operation: string;
    payloadId: string;
    error: Error | string;
    metadata?: any;
  }) {
    await this.init();
    const errorMsg = typeof params.error === 'string' ? params.error : params.error.message;
    const stack = params.error instanceof Error ? params.error.stack : undefined;
    
    const errorRecord: SyncError = {
      entityType: params.entityType,
      operation: params.operation,
      payloadId: params.payloadId,
      error: errorMsg,
      stack,
      timestamp: new Date().toISOString(),
      metadata: params.metadata
    };
    
    return await mizanDb.syncErrors.add(errorRecord);
  }

  async getSyncErrors(): Promise<SyncError[]> {
    await this.init();
    return await mizanDb.syncErrors.orderBy('timestamp').reverse().toArray();
  }

  async clearTable(table: string) {
    await this.init();
    if (table === 'settings') {
      await mizanDb.settings.clear();
    } else if ((mizanDb as any)[table]) {
      await (mizanDb as any)[table].clear();
    }
  }
}

export const localStore = new LocalStore();
