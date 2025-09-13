/**
 * خدمة تطبيق migration التكامل
 */
export class IntegrationMigrationService {
  private db: any

  constructor(database: any) {
    this.db = database
  }

  /**
   * إنشاء جدول migrations إذا لم يكن موجوداً
   */
  private ensureMigrationsTable(): void {
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    this.db.exec(createMigrationsTable)
  }

  /**
   * التحقق من تطبيق migration معين
   */
  private isMigrationApplied(version: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM migrations WHERE version = ?')
      const result = stmt.get(version)
      return result.count > 0
    } catch {
      return false
    }
  }

  /**
   * تسجيل migration كمطبق
   */
  private recordMigration(version: string, name: string): void {
    const stmt = this.db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)')
    stmt.run(version, name)
  }

  /**
   * التحقق من وجود عمود في جدول
   */
  private columnExists(tableName: string, columnName: string): boolean {
    try {
      const stmt = this.db.prepare(`PRAGMA table_info(${tableName})`)
      const columns = stmt.all()
      return columns.some((col: any) => col.name === columnName)
    } catch {
      return false
    }
  }

  /**
   * التحقق من وجود جدول
   */
  private tableExists(tableName: string): boolean {
    try {
      const stmt = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `)
      return stmt.get(tableName) !== undefined
    } catch {
      return false
    }
  }

  /**
   * تطبيق migration التكامل
   */
  async applyIntegrationMigration(): Promise<void> {
    this.ensureMigrationsTable()
    
    const version = '001'
    const name = 'add_integration_fields'
    
    if (this.isMigrationApplied(version)) {
      console.log(`✅ Migration ${version} مطبق مسبقاً`)
      return
    }

    console.log(`🔄 تطبيق migration: ${version} - ${name}`)

    try {
      // إضافة عمود tooth_treatment_id إلى جدول prescriptions
      if (!this.columnExists('prescriptions', 'tooth_treatment_id')) {
        this.db.exec('ALTER TABLE prescriptions ADD COLUMN tooth_treatment_id TEXT')
        console.log('✅ تم إضافة عمود tooth_treatment_id إلى جدول prescriptions')
      }

      // إضافة أعمدة جديدة إلى جدول lab_orders
      if (!this.columnExists('lab_orders', 'appointment_id')) {
        this.db.exec('ALTER TABLE lab_orders ADD COLUMN appointment_id TEXT')
        console.log('✅ تم إضافة عمود appointment_id إلى جدول lab_orders')
      }

      if (!this.columnExists('lab_orders', 'tooth_treatment_id')) {
        this.db.exec('ALTER TABLE lab_orders ADD COLUMN tooth_treatment_id TEXT')
        console.log('✅ تم إضافة عمود tooth_treatment_id إلى جدول lab_orders')
      }

      if (!this.columnExists('lab_orders', 'expected_delivery_date')) {
        this.db.exec('ALTER TABLE lab_orders ADD COLUMN expected_delivery_date TEXT')
        console.log('✅ تم إضافة عمود expected_delivery_date إلى جدول lab_orders')
      }

      if (!this.columnExists('lab_orders', 'actual_delivery_date')) {
        this.db.exec('ALTER TABLE lab_orders ADD COLUMN actual_delivery_date TEXT')
        console.log('✅ تم إضافة عمود actual_delivery_date إلى جدول lab_orders')
      }

      // إنشاء جدول patient_treatment_timeline
      if (!this.tableExists('patient_treatment_timeline')) {
        this.db.exec(`
          CREATE TABLE patient_treatment_timeline (
              id TEXT PRIMARY KEY,
              patient_id TEXT NOT NULL,
              appointment_id TEXT,
              tooth_treatment_id TEXT,
              prescription_id TEXT,
              lab_order_id TEXT,
              timeline_type TEXT NOT NULL CHECK (timeline_type IN ('appointment', 'treatment', 'prescription', 'lab_order', 'payment', 'note')),
              title TEXT NOT NULL,
              description TEXT,
              event_date DATETIME NOT NULL,
              status TEXT DEFAULT 'active',
              priority INTEGER DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
              FOREIGN KEY (tooth_treatment_id) REFERENCES tooth_treatments(id) ON DELETE SET NULL,
              FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL,
              FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id) ON DELETE SET NULL
          )
        `)
        console.log('✅ تم إنشاء جدول patient_treatment_timeline')
      }

      // إنشاء جدول treatment_plans
      if (!this.tableExists('treatment_plans')) {
        this.db.exec(`
          CREATE TABLE treatment_plans (
              id TEXT PRIMARY KEY,
              patient_id TEXT NOT NULL,
              plan_name TEXT NOT NULL,
              description TEXT,
              total_estimated_cost DECIMAL(10,2) DEFAULT 0,
              estimated_duration_weeks INTEGER,
              status TEXT DEFAULT 'draft',
              start_date DATE,
              target_completion_date DATE,
              actual_completion_date DATE,
              created_by TEXT,
              notes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
          )
        `)
        console.log('✅ تم إنشاء جدول treatment_plans')
      }

      // إنشاء جدول treatment_plan_items
      if (!this.tableExists('treatment_plan_items')) {
        this.db.exec(`
          CREATE TABLE treatment_plan_items (
              id TEXT PRIMARY KEY,
              treatment_plan_id TEXT NOT NULL,
              tooth_treatment_id TEXT,
              sequence_order INTEGER NOT NULL,
              title TEXT NOT NULL,
              description TEXT,
              estimated_cost DECIMAL(10,2) DEFAULT 0,
              estimated_duration_minutes INTEGER,
              status TEXT DEFAULT 'pending',
              dependencies TEXT,
              notes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plans(id) ON DELETE CASCADE,
              FOREIGN KEY (tooth_treatment_id) REFERENCES tooth_treatments(id) ON DELETE SET NULL
          )
        `)
        console.log('✅ تم إنشاء جدول treatment_plan_items')
      }

      // إنشاء indexes
      this.createIndexes()

      // تسجيل migration كمطبق
      this.recordMigration(version, name)
      
      console.log(`✅ تم تطبيق migration بنجاح: ${version}`)
    } catch (error) {
      console.error(`❌ خطأ في تطبيق migration ${version}:`, error)
      throw error
    }
  }

  /**
   * إنشاء indexes للأداء
   */
  private createIndexes(): void {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_prescriptions_tooth_treatment ON prescriptions(tooth_treatment_id)',
      'CREATE INDEX IF NOT EXISTS idx_lab_orders_appointment ON lab_orders(appointment_id)',
      'CREATE INDEX IF NOT EXISTS idx_lab_orders_tooth_treatment ON lab_orders(tooth_treatment_id)',
      'CREATE INDEX IF NOT EXISTS idx_lab_orders_expected_delivery ON lab_orders(expected_delivery_date)',
      'CREATE INDEX IF NOT EXISTS idx_lab_orders_actual_delivery ON lab_orders(actual_delivery_date)',
      'CREATE INDEX IF NOT EXISTS idx_patient_timeline_patient ON patient_treatment_timeline(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_patient_timeline_date ON patient_treatment_timeline(event_date)',
      'CREATE INDEX IF NOT EXISTS idx_patient_timeline_type ON patient_treatment_timeline(timeline_type)',
      'CREATE INDEX IF NOT EXISTS idx_patient_timeline_status ON patient_treatment_timeline(status)',
      'CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON treatment_plans(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_treatment_plans_status ON treatment_plans(status)',
      'CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_plan ON treatment_plan_items(treatment_plan_id)',
      'CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_sequence ON treatment_plan_items(treatment_plan_id, sequence_order)',
      'CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_status ON treatment_plan_items(status)'
    ]

    indexes.forEach(indexSQL => {
      try {
        this.db.exec(indexSQL)
      } catch (error) {
        console.warn('تحذير: فشل في إنشاء index:', error)
      }
    })

    console.log('✅ تم إنشاء indexes')
  }

  /**
   * التحقق من حالة قاعدة البيانات
   */
  checkDatabaseStatus(): any {
    this.ensureMigrationsTable()
    
    const appliedMigrations = this.db.prepare('SELECT * FROM migrations ORDER BY executed_at').all()

    return {
      appliedMigrations: appliedMigrations.length,
      migrations: appliedMigrations,
      tables: {
        patient_treatment_timeline: this.tableExists('patient_treatment_timeline'),
        treatment_plans: this.tableExists('treatment_plans'),
        treatment_plan_items: this.tableExists('treatment_plan_items')
      },
      columns: {
        prescriptions_tooth_treatment_id: this.columnExists('prescriptions', 'tooth_treatment_id'),
        lab_orders_appointment_id: this.columnExists('lab_orders', 'appointment_id'),
        lab_orders_tooth_treatment_id: this.columnExists('lab_orders', 'tooth_treatment_id'),
        lab_orders_expected_delivery_date: this.columnExists('lab_orders', 'expected_delivery_date'),
        lab_orders_actual_delivery_date: this.columnExists('lab_orders', 'actual_delivery_date')
      }
    }
  }

  /**
   * إنشاء بيانات تجريبية للجدول الزمني
   */
  async createSampleTimelineData(): Promise<void> {
    try {
      // الحصول على بعض المرضى الموجودين
      const patients = this.db.prepare('SELECT * FROM patients LIMIT 3').all()
      
      if (patients.length === 0) {
        console.log('لا توجد مرضى لإنشاء بيانات تجريبية')
        return
      }

      const sampleEvents = [
        {
          timeline_type: 'note',
          title: 'بداية خطة العلاج',
          description: 'تم وضع خطة علاج شاملة للمريض',
          priority: 1
        },
        {
          timeline_type: 'note',
          title: 'تقييم أولي',
          description: 'تم إجراء فحص شامل وتقييم حالة الأسنان',
          priority: 2
        },
        {
          timeline_type: 'note',
          title: 'مراجعة دورية',
          description: 'مراجعة تقدم العلاج والتأكد من سير الخطة',
          priority: 3
        }
      ]

      for (const patient of patients) {
        for (let i = 0; i < sampleEvents.length; i++) {
          const event = sampleEvents[i]
          const eventDate = new Date()
          eventDate.setDate(eventDate.getDate() - (i * 7)) // أحداث أسبوعية

          const stmt = this.db.prepare(`
            INSERT INTO patient_treatment_timeline (
              id, patient_id, timeline_type, title, description, event_date, status, priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)

          stmt.run(
            `timeline_${patient.id}_${i}`,
            patient.id,
            event.timeline_type,
            event.title,
            event.description,
            eventDate.toISOString(),
            'completed',
            event.priority
          )
        }
      }

      console.log('✅ تم إنشاء بيانات تجريبية للجدول الزمني')
    } catch (error) {
      console.error('خطأ في إنشاء البيانات التجريبية:', error)
    }
  }
}
