import { useEffect, useCallback } from 'react'
import { useAppointmentStore } from '@/store/appointmentStore'
import { usePaymentStore } from '@/store/paymentStore'
import { usePatientStore } from '@/store/patientStore'
import { usePrescriptionStore } from '@/store/prescriptionStore'
import { useInventoryStore } from '@/store/inventoryStore'

/**
 * Hook لضمان تحديث الجداول في الوقت الفعلي عند تغيير البيانات
 * يحل مشكلة عدم تحديث الجداول عند تعديل البيانات
 */
export function useRealTimeTableSync() {
  const { loadAppointments } = useAppointmentStore()
  const { loadPayments } = usePaymentStore()
  const { loadPatients } = usePatientStore()
  const { loadPrescriptions } = usePrescriptionStore()
  const { loadInventoryItems } = useInventoryStore()

  // دالة لإعادة تحميل جميع البيانات
  const refreshAllTables = useCallback(async () => {
    console.log('🔄 Refreshing all tables...')
    try {
      await Promise.all([
        loadAppointments(),
        loadPayments(),
        loadPatients(),
        loadPrescriptions(),
        loadInventoryItems()
      ])
      console.log('✅ All tables refreshed successfully')
    } catch (error) {
      console.error('❌ Error refreshing tables:', error)
    }
  }, [loadAppointments, loadPayments, loadPatients, loadPrescriptions, loadInventoryItems])

  // دالة لإعادة تحميل جدول محدد
  const refreshTable = useCallback(async (tableType: string) => {
    console.log(`🔄 Refreshing ${tableType} table...`)
    try {
      switch (tableType) {
        case 'appointments':
          await loadAppointments()
          break
        case 'payments':
          await loadPayments()
          break
        case 'patients':
          await loadPatients()
          break
        case 'prescriptions':
          await loadPrescriptions()
          break
        case 'inventory':
          await loadInventoryItems()
          break
        default:
          console.warn('Unknown table type:', tableType)
      }
      console.log(`✅ ${tableType} table refreshed successfully`)
    } catch (error) {
      console.error(`❌ Error refreshing ${tableType} table:`, error)
    }
  }, [loadAppointments, loadPayments, loadPatients, loadPrescriptions, loadInventoryItems])

  useEffect(() => {
    console.log('🔔 Setting up real-time table sync listeners...')

    // دوال معالجة الأحداث
    const handleAppointmentChange = async (event: any) => {
      console.log('📅 Appointment changed, refreshing appointments table...', event.detail?.type)
      setTimeout(() => refreshTable('appointments'), 50)
    }

    const handlePaymentChange = async (event: any) => {
      console.log('💰 Payment changed, refreshing payments table...', event.detail?.type)
      setTimeout(() => refreshTable('payments'), 50)
    }

    const handlePatientChange = async (event: any) => {
      console.log('👤 Patient changed, refreshing patients table...', event.detail?.type)
      setTimeout(() => refreshTable('patients'), 50)
      // أيضاً تحديث المواعيد والدفعات لأنها تحتوي على بيانات المرضى
      setTimeout(() => {
        refreshTable('appointments')
        refreshTable('payments')
      }, 100)
    }

    const handlePrescriptionChange = async (event: any) => {
      console.log('💊 Prescription changed, refreshing prescriptions table...', event.detail?.type)
      setTimeout(() => refreshTable('prescriptions'), 50)
    }

    const handleInventoryChange = async (event: any) => {
      console.log('📦 Inventory changed, refreshing inventory table...', event.detail?.type)
      setTimeout(() => refreshTable('inventory'), 50)
    }

    // تسجيل المستمعين لأحداث تغيير البيانات
    const appointmentEvents = ['appointment-added', 'appointment-updated', 'appointment-deleted', 'appointment-changed']
    const paymentEvents = ['payment-added', 'payment-updated', 'payment-deleted', 'payment-changed']
    const patientEvents = ['patient-added', 'patient-updated', 'patient-deleted', 'patient-changed']
    const prescriptionEvents = ['prescription-added', 'prescription-updated', 'prescription-deleted', 'prescription-changed']
    const inventoryEvents = ['inventory-added', 'inventory-updated', 'inventory-deleted', 'inventory-changed']

    // إضافة المستمعين
    appointmentEvents.forEach(eventName => {
      window.addEventListener(eventName, handleAppointmentChange)
    })

    paymentEvents.forEach(eventName => {
      window.addEventListener(eventName, handlePaymentChange)
    })

    patientEvents.forEach(eventName => {
      window.addEventListener(eventName, handlePatientChange)
    })

    prescriptionEvents.forEach(eventName => {
      window.addEventListener(eventName, handlePrescriptionChange)
    })

    inventoryEvents.forEach(eventName => {
      window.addEventListener(eventName, handleInventoryChange)
    })

    // دالة التنظيف
    return () => {
      console.log('🔔 Cleaning up real-time table sync listeners...')

      appointmentEvents.forEach(eventName => {
        window.removeEventListener(eventName, handleAppointmentChange)
      })

      paymentEvents.forEach(eventName => {
        window.removeEventListener(eventName, handlePaymentChange)
      })

      patientEvents.forEach(eventName => {
        window.removeEventListener(eventName, handlePatientChange)
      })

      prescriptionEvents.forEach(eventName => {
        window.removeEventListener(eventName, handlePrescriptionChange)
      })

      inventoryEvents.forEach(eventName => {
        window.removeEventListener(eventName, handleInventoryChange)
      })
    }
  }, [refreshTable])

  return {
    refreshAllTables,
    refreshTable
  }
}

/**
 * Hook مبسط لتحديث جدول محدد
 */
export function useTableRefresh(tableType: string) {
  const { refreshTable } = useRealTimeTableSync()

  const refresh = useCallback(() => {
    refreshTable(tableType)
  }, [refreshTable, tableType])

  return { refresh }
}

/**
 * Hook لتحديث جداول متعددة
 */
export function useMultiTableRefresh(tableTypes: string[]) {
  const { refreshTable } = useRealTimeTableSync()

  const refresh = useCallback(() => {
    tableTypes.forEach(tableType => {
      refreshTable(tableType)
    })
  }, [refreshTable, tableTypes])

  return { refresh }
}
