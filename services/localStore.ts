import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'mizan_db_v4';
const DB_VERSION = 1;

export interface OutboxItem {
  id?: number;
  entityType: string;
  operation: 'insert' | 'update' | 'delete';
  payload: any;
  createdAt: string;
}

export class LocalStore {
  private db: IDBPDatabase | null = null;

  async init() {
    if (this.db) return;
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const tables = [
          'products', 'batches', 'customers', 'suppliers', 'invoices',
          'purchaseInvoices', 'cashTransactions', 'warehouses', 'representatives',
          'dailyClosings', 'pendingAdjustments', 'purchaseOrders', 'settings', 'outbox'
        ];
        tables.forEach(table => {
          if (!db.objectStoreNames.contains(table)) {
            if (table === 'outbox') {
              db.createObjectStore(table, { keyPath: 'id', autoIncrement: true });
            } else if (table === 'settings') {
              db.createObjectStore(table);
            } else {
              db.createObjectStore(table, { keyPath: 'id' });
            }
          }
        });
      },
    });
  }

  async loadAll() {
    if (!this.db) await this.init();
    const tables = [
      'products', 'batches', 'customers', 'suppliers', 'invoices',
      'purchaseInvoices', 'cashTransactions', 'warehouses', 'representatives',
      'dailyClosings', 'pendingAdjustments', 'purchaseOrders'
    ];
    
    const result: any = {};
    for (const table of tables) {
      result[table] = await this.db!.getAll(table);
    }
    
    const settings = await this.db!.get('settings', 'main');
    result.settings = settings || null;
    
    const outbox = await this.db!.getAll('outbox');
    result.outbox = outbox || [];
    
    return result;
  }

  async saveAll(data: any) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(Object.keys(data), 'readwrite');
    for (const table of Object.keys(data)) {
      if (table === 'settings') {
        await tx.objectStore(table).put(data[table], 'main');
      } else if (table === 'outbox') {
        // Handle outbox separately or clear and refill?
        // Usually outbox is managed incrementally.
      } else {
        const store = tx.objectStore(table);
        await store.clear();
        for (const item of data[table]) {
          await store.put(item);
        }
      }
    }
    await tx.done;
  }

  async upsert(table: string, item: any) {
    if (!this.db) await this.init();
    if (table === 'settings') {
      await this.db!.put('settings', item, 'main');
    } else {
      await this.db!.put(table, item);
    }
  }

  async delete(table: string, id: string) {
    if (!this.db) await this.init();
    await this.db!.delete(table, id);
  }

  async addToOutbox(item: OutboxItem) {
    if (!this.db) await this.init();
    return await this.db!.add('outbox', item);
  }

  async getOutbox() {
    if (!this.db) await this.init();
    return await this.db!.getAll('outbox');
  }

  async removeFromOutbox(id: number) {
    if (!this.db) await this.init();
    await this.db!.delete('outbox', id);
  }

  async clearTable(table: string) {
    if (!this.db) await this.init();
    await this.db!.clear(table);
  }
}

export const localStore = new LocalStore();
