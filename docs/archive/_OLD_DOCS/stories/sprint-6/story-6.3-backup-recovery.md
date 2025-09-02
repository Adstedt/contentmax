# Story 6.3: Backup and Recovery System

## User Story

As a system administrator,
I want automated backup and recovery capabilities,
So that I can quickly restore the system in case of data loss or corruption.

## Size & Priority

- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 6
- **Dependencies**: Task 1.2 (Supabase setup)

## Description

Implement a comprehensive backup and recovery system with automated backups, point-in-time recovery, data validation, and disaster recovery procedures for both database and file storage.

## Implementation Steps

1. **Automated backup system**

   ```typescript
   // lib/backup/backup-manager.ts
   import { createClient } from '@supabase/supabase-js';
   import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
   import { exec } from 'child_process';
   import { promisify } from 'util';

   const execAsync = promisify(exec);

   interface BackupConfig {
     schedule: string; // Cron expression
     retention: {
       daily: number;
       weekly: number;
       monthly: number;
     };
     destinations: BackupDestination[];
   }

   class BackupManager {
     private supabase: SupabaseClient;
     private s3Client: S3Client;
     private config: BackupConfig;

     constructor(config: BackupConfig) {
       this.config = config;
       this.supabase = createClient(
         process.env.SUPABASE_URL!,
         process.env.SUPABASE_SERVICE_ROLE_KEY!
       );

       this.s3Client = new S3Client({
         region: process.env.AWS_REGION,
         credentials: {
           accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
           secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
         },
       });

       this.scheduleBackups();
     }

     private scheduleBackups() {
       cron.schedule(this.config.schedule, async () => {
         await this.performBackup();
       });

       // Additional schedules for different backup types
       cron.schedule('0 0 * * *', () => this.performDailyBackup());
       cron.schedule('0 0 * * 0', () => this.performWeeklyBackup());
       cron.schedule('0 0 1 * *', () => this.performMonthlyBackup());
     }

     async performBackup(type: 'full' | 'incremental' = 'full'): Promise<BackupResult> {
       const backupId = this.generateBackupId();
       const startTime = Date.now();

       try {
         console.log(`Starting ${type} backup: ${backupId}`);

         // 1. Create backup metadata
         const metadata = await this.createBackupMetadata(backupId, type);

         // 2. Backup database
         const dbBackup = await this.backupDatabase(backupId);

         // 3. Backup file storage
         const storageBackup = await this.backupStorage(backupId);

         // 4. Backup configuration and secrets
         const configBackup = await this.backupConfiguration(backupId);

         // 5. Create backup manifest
         const manifest = this.createManifest({
           id: backupId,
           type,
           timestamp: new Date(),
           database: dbBackup,
           storage: storageBackup,
           config: configBackup,
           metadata,
         });

         // 6. Upload to destinations
         await this.uploadToDestinations(backupId, manifest);

         // 7. Verify backup integrity
         await this.verifyBackup(backupId);

         // 8. Clean up old backups
         await this.cleanupOldBackups();

         const duration = Date.now() - startTime;

         console.log(`Backup completed: ${backupId} in ${duration}ms`);

         return {
           success: true,
           backupId,
           duration,
           size: dbBackup.size + storageBackup.size,
           manifest,
         };
       } catch (error) {
         console.error(`Backup failed: ${backupId}`, error);
         await this.notifyBackupFailure(backupId, error);
         throw error;
       }
     }

     private async backupDatabase(backupId: string): Promise<DatabaseBackup> {
       // Use Supabase's backup API
       const { data: backup } = await this.supabase.rpc('create_backup', {
         backup_id: backupId,
       });

       // Also create a SQL dump for extra safety
       const dumpFile = `/tmp/backup_${backupId}.sql`;
       await execAsync(`pg_dump ${process.env.DATABASE_URL} > ${dumpFile}`);

       // Compress the dump
       await execAsync(`gzip ${dumpFile}`);

       // Upload to S3
       const fileContent = await fs.readFile(`${dumpFile}.gz`);
       await this.s3Client.send(
         new PutObjectCommand({
           Bucket: process.env.BACKUP_BUCKET!,
           Key: `database/${backupId}/dump.sql.gz`,
           Body: fileContent,
           ServerSideEncryption: 'AES256',
         })
       );

       return {
         backupId: backup.id,
         location: `s3://${process.env.BACKUP_BUCKET}/database/${backupId}/`,
         size: fileContent.length,
         timestamp: new Date(),
       };
     }

     private async backupStorage(backupId: string): Promise<StorageBackup> {
       const buckets = ['content', 'images', 'templates'];
       const backupTasks = [];

       for (const bucket of buckets) {
         backupTasks.push(this.backupBucket(bucket, backupId));
       }

       const results = await Promise.all(backupTasks);

       return {
         buckets: results,
         totalSize: results.reduce((sum, r) => sum + r.size, 0),
         fileCount: results.reduce((sum, r) => sum + r.fileCount, 0),
       };
     }

     private async backupBucket(bucketName: string, backupId: string): Promise<BucketBackup> {
       const { data: files } = await this.supabase.storage
         .from(bucketName)
         .list('', { limit: 10000 });

       let totalSize = 0;
       const fileBackups = [];

       for (const file of files || []) {
         const { data } = await this.supabase.storage.from(bucketName).download(file.name);

         if (data) {
           const key = `storage/${backupId}/${bucketName}/${file.name}`;
           await this.s3Client.send(
             new PutObjectCommand({
               Bucket: process.env.BACKUP_BUCKET!,
               Key: key,
               Body: data,
               ServerSideEncryption: 'AES256',
             })
           );

           totalSize += data.size;
           fileBackups.push({
             name: file.name,
             size: data.size,
             key,
           });
         }
       }

       return {
         bucket: bucketName,
         fileCount: fileBackups.length,
         size: totalSize,
         files: fileBackups,
       };
     }

     private async verifyBackup(backupId: string): Promise<boolean> {
       // Verify database backup
       const dbVerified = await this.verifyDatabaseBackup(backupId);

       // Verify storage backup
       const storageVerified = await this.verifyStorageBackup(backupId);

       // Verify manifest integrity
       const manifestVerified = await this.verifyManifest(backupId);

       if (!dbVerified || !storageVerified || !manifestVerified) {
         throw new Error(`Backup verification failed for ${backupId}`);
       }

       return true;
     }

     private async cleanupOldBackups() {
       const backups = await this.listBackups();
       const now = Date.now();

       const toDelete = backups.filter((backup) => {
         const age = now - backup.timestamp.getTime();
         const days = age / (1000 * 60 * 60 * 24);

         if (backup.type === 'daily' && days > this.config.retention.daily) {
           return true;
         }
         if (backup.type === 'weekly' && days > this.config.retention.weekly * 7) {
           return true;
         }
         if (backup.type === 'monthly' && days > this.config.retention.monthly * 30) {
           return true;
         }

         return false;
       });

       for (const backup of toDelete) {
         await this.deleteBackup(backup.id);
       }

       console.log(`Cleaned up ${toDelete.length} old backups`);
     }
   }
   ```

2. **Recovery system**

   ```typescript
   // lib/backup/recovery-manager.ts
   class RecoveryManager {
     private backupManager: BackupManager;
     private supabase: SupabaseClient;

     constructor() {
       this.backupManager = new BackupManager(getBackupConfig());
       this.supabase = createClient(
         process.env.SUPABASE_URL!,
         process.env.SUPABASE_SERVICE_ROLE_KEY!
       );
     }

     async restoreFromBackup(
       backupId: string,
       options: RestoreOptions = {}
     ): Promise<RestoreResult> {
       console.log(`Starting restoration from backup: ${backupId}`);

       try {
         // 1. Validate backup exists and is complete
         const backup = await this.validateBackup(backupId);

         // 2. Create restore point for rollback
         const restorePoint = await this.createRestorePoint();

         // 3. Put system in maintenance mode
         await this.enableMaintenanceMode();

         // 4. Restore database
         if (options.includeDatabase !== false) {
           await this.restoreDatabase(backup.database);
         }

         // 5. Restore file storage
         if (options.includeStorage !== false) {
           await this.restoreStorage(backup.storage);
         }

         // 6. Restore configuration
         if (options.includeConfig !== false) {
           await this.restoreConfiguration(backup.config);
         }

         // 7. Verify restoration
         const verified = await this.verifyRestoration(backup);

         if (!verified) {
           console.error('Restoration verification failed, rolling back...');
           await this.rollbackToRestorePoint(restorePoint);
           throw new Error('Restoration verification failed');
         }

         // 8. Clear caches
         await this.clearAllCaches();

         // 9. Disable maintenance mode
         await this.disableMaintenanceMode();

         console.log(`Restoration completed successfully from: ${backupId}`);

         return {
           success: true,
           backupId,
           restoredAt: new Date(),
           restorePoint,
         };
       } catch (error) {
         console.error('Restoration failed:', error);
         await this.disableMaintenanceMode();
         throw error;
       }
     }

     async performPointInTimeRecovery(
       targetTime: Date,
       options: PITROptions = {}
     ): Promise<RestoreResult> {
       console.log(`Starting point-in-time recovery to: ${targetTime}`);

       // Find the closest backup before target time
       const baseBackup = await this.findClosestBackup(targetTime);

       // Restore base backup
       await this.restoreFromBackup(baseBackup.id, {
         includeConfig: false,
       });

       // Apply transaction logs up to target time
       await this.applyTransactionLogs(baseBackup.timestamp, targetTime);

       // Verify data consistency
       await this.verifyDataConsistency(targetTime);

       return {
         success: true,
         targetTime,
         baseBackup: baseBackup.id,
         restoredAt: new Date(),
       };
     }

     private async restoreDatabase(dbBackup: DatabaseBackup) {
       console.log('Restoring database...');

       // Download backup from S3
       const { Body } = await this.s3Client.send(
         new GetObjectCommand({
           Bucket: process.env.BACKUP_BUCKET!,
           Key: `database/${dbBackup.backupId}/dump.sql.gz`,
         })
       );

       // Save to temp file
       const tempFile = `/tmp/restore_${dbBackup.backupId}.sql.gz`;
       await fs.writeFile(tempFile, Body);

       // Decompress
       await execAsync(`gunzip ${tempFile}`);

       // Drop existing database (careful!)
       await execAsync(
         `psql ${process.env.DATABASE_URL} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
       );

       // Restore from dump
       await execAsync(`psql ${process.env.DATABASE_URL} < ${tempFile.replace('.gz', '')}`);

       // Run migrations to ensure schema is up to date
       await this.runMigrations();

       console.log('Database restoration completed');
     }

     private async restoreStorage(storageBackup: StorageBackup) {
       console.log('Restoring file storage...');

       for (const bucket of storageBackup.buckets) {
         // Clear existing bucket
         await this.clearBucket(bucket.bucket);

         // Restore files
         for (const file of bucket.files) {
           const { Body } = await this.s3Client.send(
             new GetObjectCommand({
               Bucket: process.env.BACKUP_BUCKET!,
               Key: file.key,
             })
           );

           await this.supabase.storage
             .from(bucket.bucket)
             .upload(file.name, Body, { upsert: true });
         }

         console.log(`Restored ${bucket.fileCount} files to ${bucket.bucket}`);
       }
     }

     private async verifyRestoration(backup: Backup): Promise<boolean> {
       const checks = [
         this.verifyDatabaseIntegrity(),
         this.verifyStorageIntegrity(),
         this.verifySystemFunctionality(),
       ];

       const results = await Promise.all(checks);
       return results.every((r) => r === true);
     }

     private async verifyDatabaseIntegrity(): Promise<boolean> {
       // Check table counts
       const tables = ['users', 'content', 'templates', 'generation_history'];

       for (const table of tables) {
         const { count } = await this.supabase
           .from(table)
           .select('*', { count: 'exact', head: true });

         if (count === null) {
           console.error(`Table ${table} verification failed`);
           return false;
         }
       }

       // Check foreign key constraints
       const { error } = await this.supabase.rpc('verify_constraints');
       if (error) {
         console.error('Constraint verification failed:', error);
         return false;
       }

       return true;
     }
   }
   ```

3. **Disaster recovery procedures**

   ```typescript
   // lib/backup/disaster-recovery.ts
   class DisasterRecoveryManager {
     private recoveryManager: RecoveryManager;
     private monitoringClient: MonitoringClient;

     async executeDisasterRecovery(scenario: DisasterScenario): Promise<RecoveryResult> {
       console.log(`Initiating disaster recovery for: ${scenario.type}`);

       // 1. Assess damage
       const assessment = await this.assessDamage(scenario);

       // 2. Notify stakeholders
       await this.notifyStakeholders(scenario, assessment);

       // 3. Execute recovery plan
       const recoveryPlan = this.selectRecoveryPlan(scenario, assessment);
       const result = await this.executeRecoveryPlan(recoveryPlan);

       // 4. Verify recovery
       await this.verifyRecovery(result);

       // 5. Create incident report
       await this.createIncidentReport(scenario, assessment, result);

       return result;
     }

     private selectRecoveryPlan(
       scenario: DisasterScenario,
       assessment: DamageAssessment
     ): RecoveryPlan {
       switch (scenario.type) {
         case 'data-corruption':
           return this.createDataCorruptionRecoveryPlan(assessment);

         case 'ransomware':
           return this.createRansomwareRecoveryPlan(assessment);

         case 'hardware-failure':
           return this.createHardwareFailureRecoveryPlan(assessment);

         case 'region-outage':
           return this.createRegionOutageRecoveryPlan(assessment);

         default:
           return this.createGeneralRecoveryPlan(assessment);
       }
     }

     private async executeRecoveryPlan(plan: RecoveryPlan): Promise<RecoveryResult> {
       const steps = plan.steps;
       const results = [];

       for (const step of steps) {
         console.log(`Executing recovery step: ${step.name}`);

         try {
           const result = await this.executeStep(step);
           results.push(result);

           if (step.critical && !result.success) {
             throw new Error(`Critical step failed: ${step.name}`);
           }
         } catch (error) {
           console.error(`Step failed: ${step.name}`, error);

           if (step.fallback) {
             const fallbackResult = await this.executeStep(step.fallback);
             results.push(fallbackResult);
           } else {
             throw error;
           }
         }
       }

       return {
         plan: plan.name,
         steps: results,
         success: results.every((r) => r.success),
         duration: Date.now() - plan.startTime,
       };
     }

     private createDataCorruptionRecoveryPlan(assessment: DamageAssessment): RecoveryPlan {
       return {
         name: 'Data Corruption Recovery',
         startTime: Date.now(),
         steps: [
           {
             name: 'Isolate corrupted data',
             critical: true,
             execute: async () => {
               await this.quarantineCorruptedData(assessment.affectedTables);
             },
           },
           {
             name: 'Find last known good backup',
             critical: true,
             execute: async () => {
               const backup = await this.findLastGoodBackup(assessment.corruptionDetectedAt);
               return { backup };
             },
           },
           {
             name: 'Restore from backup',
             critical: true,
             execute: async (context) => {
               await this.recoveryManager.restoreFromBackup(context.backup.id, {
                 selective: assessment.affectedTables,
               });
             },
             fallback: {
               name: 'Restore from older backup',
               execute: async () => {
                 const olderBackup = await this.findPreviousBackup();
                 await this.recoveryManager.restoreFromBackup(olderBackup.id);
               },
             },
           },
           {
             name: 'Replay recent transactions',
             critical: false,
             execute: async () => {
               await this.replayTransactions(assessment.lastGoodTimestamp);
             },
           },
           {
             name: 'Verify data integrity',
             critical: true,
             execute: async () => {
               return await this.verifyDataIntegrity();
             },
           },
         ],
       };
     }
   }
   ```

4. **Backup monitoring UI**

   ```tsx
   // components/backup/BackupMonitor.tsx
   const BackupMonitor: React.FC = () => {
     const [backups, setBackups] = useState<Backup[]>([]);
     const [activeBackup, setActiveBackup] = useState<ActiveBackup | null>(null);
     const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus | null>(null);

     useEffect(() => {
       loadBackups();
       subscribeToBackupEvents();
     }, []);

     const subscribeToBackupEvents = () => {
       const ws = new WebSocket(process.env.NEXT_PUBLIC_BACKUP_WS_URL!);

       ws.onmessage = (event) => {
         const data = JSON.parse(event.data);

         switch (data.type) {
           case 'backup-started':
             setActiveBackup(data.backup);
             break;
           case 'backup-progress':
             setActiveBackup((prev) => ({ ...prev, ...data.progress }));
             break;
           case 'backup-completed':
             setActiveBackup(null);
             loadBackups();
             break;
           case 'recovery-status':
             setRecoveryStatus(data.status);
             break;
         }
       };
     };

     return (
       <div className="backup-monitor">
         <div className="backup-status">
           <h3>Backup Status</h3>
           {activeBackup ? (
             <ActiveBackupStatus backup={activeBackup} />
           ) : (
             <div className="next-backup">Next backup: {getNextBackupTime()}</div>
           )}
         </div>

         <div className="backup-list">
           <h3>Recent Backups</h3>
           <table>
             <thead>
               <tr>
                 <th>ID</th>
                 <th>Type</th>
                 <th>Size</th>
                 <th>Created</th>
                 <th>Status</th>
                 <th>Actions</th>
               </tr>
             </thead>
             <tbody>
               {backups.map((backup) => (
                 <BackupRow
                   key={backup.id}
                   backup={backup}
                   onRestore={(id) => initiateRestore(id)}
                   onVerify={(id) => verifyBackup(id)}
                   onDelete={(id) => deleteBackup(id)}
                 />
               ))}
             </tbody>
           </table>
         </div>

         {recoveryStatus && (
           <RecoveryStatusPanel status={recoveryStatus} onCancel={() => cancelRecovery()} />
         )}

         <BackupSettings
           onManualBackup={() => triggerManualBackup()}
           onTestRestore={() => testRestoreProcedure()}
         />
       </div>
     );
   };
   ```

5. **Backup testing automation**

   ```typescript
   // scripts/test-backup-recovery.ts
   class BackupRecoveryTester {
     async runComprehensiveTest(): Promise<TestResult> {
       const testResults = [];

       // Test 1: Full backup and restore
       testResults.push(await this.testFullBackupRestore());

       // Test 2: Incremental backup
       testResults.push(await this.testIncrementalBackup());

       // Test 3: Point-in-time recovery
       testResults.push(await this.testPointInTimeRecovery());

       // Test 4: Selective restore
       testResults.push(await this.testSelectiveRestore());

       // Test 5: Cross-region restore
       testResults.push(await this.testCrossRegionRestore());

       // Test 6: Disaster recovery scenarios
       testResults.push(await this.testDisasterRecoveryScenarios());

       return {
         passed: testResults.every((r) => r.passed),
         results: testResults,
         timestamp: new Date(),
       };
     }

     private async testFullBackupRestore(): Promise<TestCaseResult> {
       console.log('Testing full backup and restore...');

       // Create test data
       const testData = await this.createTestData();

       // Perform backup
       const backup = await this.backupManager.performBackup('full');

       // Corrupt data
       await this.corruptTestData();

       // Restore from backup
       await this.recoveryManager.restoreFromBackup(backup.backupId);

       // Verify data
       const verified = await this.verifyTestData(testData);

       return {
         name: 'Full Backup and Restore',
         passed: verified,
         duration: Date.now() - startTime,
       };
     }
   }
   ```

## Files to Create

- `lib/backup/backup-manager.ts` - Backup orchestration
- `lib/backup/recovery-manager.ts` - Recovery procedures
- `lib/backup/disaster-recovery.ts` - Disaster recovery
- `lib/backup/backup-storage.ts` - Storage management
- `lib/backup/backup-verifier.ts` - Integrity verification
- `components/backup/BackupMonitor.tsx` - Monitoring UI
- `scripts/backup-database.sh` - Database backup script
- `scripts/test-backup-recovery.ts` - Testing automation
- `.github/workflows/backup-test.yml` - Backup testing workflow

## Acceptance Criteria

- [ ] Automated daily backups
- [ ] Point-in-time recovery capability
- [ ] Backup verification after creation
- [ ] Multiple backup destinations
- [ ] Encrypted backup storage
- [ ] Recovery time < 30 minutes
- [ ] Disaster recovery procedures documented
- [ ] Regular recovery testing

## Backup Schedule

- **Daily**: Full database backup, incremental file backup
- **Weekly**: Full system backup
- **Monthly**: Archive backup to cold storage
- **On-demand**: Manual backup before major changes

## Testing Requirements

- [ ] Test backup creation
- [ ] Test restoration process
- [ ] Test point-in-time recovery
- [ ] Test selective restoration
- [ ] Test cross-region recovery
- [ ] Test backup verification
- [ ] Test retention policies
- [ ] Disaster recovery drills

## Definition of Done

- [ ] Code complete and committed
- [ ] Automated backups running
- [ ] Recovery procedures tested
- [ ] Documentation complete
- [ ] Team trained on recovery
- [ ] Monitoring integrated
- [ ] Disaster recovery plan approved
- [ ] Regular testing scheduled
