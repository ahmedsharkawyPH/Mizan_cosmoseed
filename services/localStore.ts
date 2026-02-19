import { mizanDb, OutboxItem } from './mizanDb';

export type { OutboxItem };

export class LocalStore {
  async init() {
    // Dexie opens automatically on first use, but we can call open() to be explicit
    if (!mizanDb.isOpen()) {
      await mizanDb.open();
    }
  }

  async loadAll() {
    await this.init();
    
    const tables = [
      'products', 'batches', 'customers', 'suppliers', 'invoices',
      'purchaseInvoices', 'cashTransactions', 'warehouses', 'representatives',
      'dailyClosings', 'pendingAdjustments', 'purchaseOrders'
    ];
    
    const result: any = {};
    for (const table of tables) {
      result[table] = await (mizanDb as any)[table].toArray();
    }
    
    const settingsRow = await mizanDb.settings.get('main');
    result.settings = settingsRow ? settingsRow.value : null;
    
    const outbox = await mizanDb.outbox.orderBy('id').toArray();
    result.outbox = outbox || [];
    
    return result;
  }

  async saveAll(data: any) {
    await this.init();
    
    return await mizanDb.transaction('rw', mizanDb.tables, async () => {
      for (const table of Object.keys(data)) {
        if (table === 'settings') {
          await mizanDb.settings.put({ id: 'main', value: data[table] });
        } else if (table === 'outbox') {
          // Outbox is usually managed incrementally, but if we're forcing a saveAll...
          await mizanDb.outbox.clear();
          if (Array.isArray(data[table])) {
            await mizanDb.outbox.bulkAdd(data[table]);
          }
        } else if ((mizanDb as any)[table]) {
          const dexieTable = (mizanDb as any)[table];
          await dexieTable.clear();
          if (Array.isArray(data[table])) {
            await dexieTable.bulkAdd(data[table]);
          }
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

  async addToOutbox(item: OutboxItem) {
    await this.init();
    return await mizanDb.outbox.add(item);
  }

  async getOutbox() {
    await this.init();
    return await mizanDb.outbox.orderBy('id').toArray();
  }

  async removeFromOutbox(id: number) {
    await this.init();
    await mizanDb.outbox.delete(id);
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
