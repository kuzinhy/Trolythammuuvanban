import { db, collection, getDocs, doc, setDoc, writeBatch, serverTimestamp, CONNECTED_APP_ID, CONNECTED_APP_URL, CONNECTED_APP_NAME } from './firebase';
import { AppConnectionConfig } from '../types';

export const DEFAULT_APP_CONNECTION: AppConnectionConfig = {
  connectedAppId: CONNECTED_APP_ID,
  connectedAppUrl: CONNECTED_APP_URL,
  appName: CONNECTED_APP_NAME,
  connectionStatus: 'CONNECTED',
  lastSyncedAt: new Date().toISOString(),
  sharedFirestoreProject: 'trolycvp',
  sharedCollections: [
    'documents',
    'tasks',
    'routing_rules',
    'departments',
    'legal_bases',
    'system_config',
    'audit_logs'
  ],
  syncMode: 'REALTIME',
  notes: 'Đang kết nối liên thông trực tiếp với cơ sở dữ liệu và bộ nhớ trung tâm của ứng dụng 000a18f3-b782-4432-ad25-82245f95e3a3.'
};

/**
 * Checks the connectivity to Firestore and queries the live document/task counts
 */
export async function checkAppConnectionStatus(): Promise<{
  isConnected: boolean;
  appConfig: AppConnectionConfig;
  stats: {
    documentsCount: number;
    tasksCount: number;
    departmentsCount: number;
    rulesCount: number;
    legalBasesCount: number;
  };
  latencyMs: number;
}> {
  const startTime = Date.now();
  try {
    const [docsSnap, tasksSnap, deptsSnap, rulesSnap, legalsSnap] = await Promise.all([
      getDocs(collection(db, 'documents')),
      getDocs(collection(db, 'tasks')),
      getDocs(collection(db, 'departments')),
      getDocs(collection(db, 'routing_rules')),
      getDocs(collection(db, 'legal_bases')),
    ]);

    const latencyMs = Date.now() - startTime;

    const stats = {
      documentsCount: docsSnap.size,
      tasksCount: tasksSnap.size,
      departmentsCount: deptsSnap.size,
      rulesCount: rulesSnap.size,
      legalBasesCount: legalsSnap.size,
    };

    const appConfig: AppConnectionConfig = {
      ...DEFAULT_APP_CONNECTION,
      connectionStatus: 'CONNECTED',
      lastSyncedAt: new Date().toISOString(),
      totalSyncedDocs: stats.documentsCount,
      totalSyncedTasks: stats.tasksCount,
    };

    // Store latest sync status in system_config
    try {
      await setDoc(doc(db, 'system_config', 'app_sync_status'), {
        ...appConfig,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.debug("Could not cache sync status to Firestore:", e);
    }

    return {
      isConnected: true,
      appConfig,
      stats,
      latencyMs,
    };
  } catch (error) {
    console.error("Error connecting to app database:", error);
    return {
      isConnected: false,
      appConfig: {
        ...DEFAULT_APP_CONNECTION,
        connectionStatus: 'DISCONNECTED',
        notes: `Lỗi kết nối cơ sở dữ liệu: ${error instanceof Error ? error.message : String(error)}`
      },
      stats: {
        documentsCount: 0,
        tasksCount: 0,
        departmentsCount: 0,
        rulesCount: 0,
        legalBasesCount: 0,
      },
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Export all database collections as a backup JSON object
 */
export async function exportDatabaseBackup(): Promise<string> {
  const collectionsToExport = ['documents', 'tasks', 'departments', 'routing_rules', 'legal_bases', 'system_config', 'audit_logs'];
  const fullBackup: Record<string, any[]> = {
    _meta: [
      {
        sourceAppId: CONNECTED_APP_ID,
        sourceAppUrl: CONNECTED_APP_URL,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    ]
  };

  for (const colName of collectionsToExport) {
    try {
      const snap = await getDocs(collection(db, colName));
      fullBackup[colName] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    } catch (err) {
      console.error(`Error exporting collection ${colName}:`, err);
      fullBackup[colName] = [];
    }
  }

  return JSON.stringify(fullBackup, null, 2);
}

/**
 * Import a backup JSON dataset into the Firestore database
 */
export async function importDatabaseBackup(jsonString: string): Promise<{ success: boolean; importedCount: number; message: string }> {
  try {
    const data = JSON.parse(jsonString);
    let totalImported = 0;

    const collections = ['departments', 'routing_rules', 'legal_bases', 'documents', 'tasks'];
    
    for (const colName of collections) {
      if (Array.isArray(data[colName])) {
        const batch = writeBatch(db);
        for (const item of data[colName]) {
          const { _id, id, ...rest } = item;
          const targetId = _id || id || String(Date.now() + Math.random());
          const docRef = doc(db, colName, targetId);
          batch.set(docRef, { ...rest, importedAt: serverTimestamp() }, { merge: true });
          totalImported++;
        }
        await batch.commit();
      }
    }

    return {
      success: true,
      importedCount: totalImported,
      message: `Đã nhập và đồng bộ thành công ${totalImported} bản ghi vào cơ sở dữ liệu liên thông.`
    };
  } catch (error: any) {
    console.error("Import database backup failed:", error);
    return {
      success: false,
      importedCount: 0,
      message: `Lỗi khi nhập dữ liệu: ${error.message || String(error)}`
    };
  }
}
