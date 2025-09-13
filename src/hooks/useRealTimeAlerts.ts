import { useEffect, useCallback, useRef } from 'react'
import { SmartAlertsService } from '@/services/smartAlertsService'
import { useGlobalStore } from '@/store/globalStore'

/**
 * Hook لإدارة التحديثات في الوقت الفعلي للتنبيهات
 * يضمن أن أي تعديل على التنبيهات يتم تحديثه فوراً في جميع أنحاء التطبيق
 */
export function useRealTimeAlerts() {
  const { loadAlerts } = useGlobalStore()
  const listenersRef = useRef<Map<string, Function>>(new Map())
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // دالة لإعادة تحميل التنبيهات مع تجميع الطلبات
  const refreshAlerts = useCallback(() => {
    console.log('🔄 useRealTimeAlerts: refreshAlerts triggered')

    // إلغاء أي تحديث مؤجل سابق
    if (refreshTimeoutRef.current) {
      console.log('🔄 useRealTimeAlerts: Clearing previous timeout')
      clearTimeout(refreshTimeoutRef.current)
    }

    // تأجيل التحديث لتجميع الطلبات المتعددة (زيادة التأخير لتقليل التحديثات)
    refreshTimeoutRef.current = setTimeout(() => {
      console.log('🔄 useRealTimeAlerts: Executing loadAlerts...')
      loadAlerts()
      refreshTimeoutRef.current = null
    }, 300)
  }, [loadAlerts])

  useEffect(() => {
    console.log('🔔 Setting up real-time alerts listeners...')

    // دالة معالجة تغيير البيانات مع تحسينات
    const handleDataChanged = async (event?: any) => {
      const eventType = event?.type || event?.detail?.event || 'unknown'
      console.log('📡 Data changed, refreshing alerts...', eventType)

      // تحديث فوري للتنبيهات
      refreshAlerts()
    }

    // دوال معالجة الأحداث المحسنة
    const handleAlertsChanged = (event?: any) => {
      console.log('🔔 Alerts changed event received:', event?.detail || 'no details')
      refreshAlerts()
    }

    const handleAlertUpdated = (event?: any) => {
      const data = event?.detail || event
      console.log('🔔 useRealTimeAlerts: Alert updated event received:', data)
      console.log('🔄 useRealTimeAlerts: Triggering refreshAlerts...')
      refreshAlerts()
    }

    const handleAlertCreated = (event?: any) => {
      const data = event?.detail || event
      console.log('🔔 Alert created event received:', data)
      refreshAlerts()
    }

    const handleAlertDeleted = (event?: any) => {
      const data = event?.detail || event
      console.log('🔔 Alert deleted event received:', data)
      refreshAlerts()
    }

    // حفظ المراجع للمستمعين
    listenersRef.current.set('handleDataChanged', handleDataChanged)
    listenersRef.current.set('handleAlertsChanged', handleAlertsChanged)
    listenersRef.current.set('handleAlertUpdated', handleAlertUpdated)
    listenersRef.current.set('handleAlertCreated', handleAlertCreated)
    listenersRef.current.set('handleAlertDeleted', handleAlertDeleted)

    // تسجيل المستمعين للأحداث المباشرة
    SmartAlertsService.addEventListener('alerts:changed', handleAlertsChanged)
    SmartAlertsService.addEventListener('alert:updated', handleAlertUpdated)
    SmartAlertsService.addEventListener('alert:created', handleAlertCreated)
    SmartAlertsService.addEventListener('alert:deleted', handleAlertDeleted)

    // تسجيل المستمعين لأحداث window
    window.addEventListener('alerts:alerts:changed', handleAlertsChanged)
    window.addEventListener('alerts:alert:updated', (e: any) => handleAlertUpdated(e.detail))
    window.addEventListener('alerts:alert:created', (e: any) => handleAlertCreated(e.detail))
    window.addEventListener('alerts:alert:deleted', (e: any) => handleAlertDeleted(e.detail))

    // أحداث تغيير البيانات للتوافق
    const dataChangeEvents = [
      'patient-added', 'patient-updated', 'patient-deleted', 'patient-changed',
      'appointment-added', 'appointment-updated', 'appointment-deleted', 'appointment-changed',
      'payment-added', 'payment-updated', 'payment-deleted', 'payment-changed',
      'treatment-added', 'treatment-updated', 'treatment-deleted', 'treatment-changed',
      'prescription-added', 'prescription-updated', 'prescription-deleted', 'prescription-changed',
      'inventory-added', 'inventory-updated', 'inventory-deleted', 'inventory-changed'
    ]

    // تسجيل المستمعين لأحداث تغيير البيانات
    dataChangeEvents.forEach(eventName => {
      window.addEventListener(eventName, handleDataChanged)
    })

    // دالة التنظيف المحسنة
    return () => {
      console.log('🔔 Cleaning up real-time alerts listeners...')

      // إلغاء أي تحديث مؤجل
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }

      // الحصول على المراجع المحفوظة للمستمعين
      const savedListeners = listenersRef.current

      // إزالة مستمعي الأحداث المباشرة
      if (savedListeners.has('handleAlertsChanged')) {
        SmartAlertsService.removeEventListener('alerts:changed', savedListeners.get('handleAlertsChanged')!)
      }
      if (savedListeners.has('handleAlertUpdated')) {
        SmartAlertsService.removeEventListener('alert:updated', savedListeners.get('handleAlertUpdated')!)
      }
      if (savedListeners.has('handleAlertCreated')) {
        SmartAlertsService.removeEventListener('alert:created', savedListeners.get('handleAlertCreated')!)
      }
      if (savedListeners.has('handleAlertDeleted')) {
        SmartAlertsService.removeEventListener('alert:deleted', savedListeners.get('handleAlertDeleted')!)
      }

      // إزالة مستمعي أحداث window
      if (savedListeners.has('handleAlertsChanged')) {
        window.removeEventListener('alerts:alerts:changed', savedListeners.get('handleAlertsChanged')!)
      }
      if (savedListeners.has('handleAlertUpdated')) {
        const handler = savedListeners.get('handleAlertUpdated')!
        window.removeEventListener('alerts:alert:updated', (e: any) => handler(e.detail))
      }
      if (savedListeners.has('handleAlertCreated')) {
        const handler = savedListeners.get('handleAlertCreated')!
        window.removeEventListener('alerts:alert:created', (e: any) => handler(e.detail))
      }
      if (savedListeners.has('handleAlertDeleted')) {
        const handler = savedListeners.get('handleAlertDeleted')!
        window.removeEventListener('alerts:alert:deleted', (e: any) => handler(e.detail))
      }

      // إزالة مستمعي أحداث تغيير البيانات
      if (savedListeners.has('handleDataChanged')) {
        const handler = savedListeners.get('handleDataChanged')!
        dataChangeEvents.forEach(eventName => {
          window.removeEventListener(eventName, handler)
        })
      }

      // تنظيف المراجع
      listenersRef.current.clear()
    }
  }, [refreshAlerts])

  return {
    refreshAlerts
  }
}

/**
 * Hook مبسط لاستخدام التحديثات في الوقت الفعلي
 * يمكن استخدامه في أي مكون يحتاج لمراقبة تغييرات التنبيهات
 */
export function useAlertUpdates() {
  const { alerts, unreadAlertsCount, loadAlerts } = useGlobalStore()

  // إعداد التحديثات في الوقت الفعلي
  useRealTimeAlerts()

  return {
    alerts,
    unreadAlertsCount,
    refreshAlerts: loadAlerts
  }
}

/**
 * Hook لمراقبة تنبيه محدد
 */
export function useAlertMonitor(alertId: string) {
  const { alerts } = useGlobalStore()

  // العثور على التنبيه المحدد
  const alert = alerts.find(a => a.id === alertId)

  useEffect(() => {
    if (!alertId) return

    const handleAlertUpdated = (data: any) => {
      if (data.alertId === alertId) {
        console.log(`🔔 Monitored alert ${alertId} updated:`, data.updates)
      }
    }

    const handleAlertDeleted = (data: any) => {
      if (data.alertId === alertId) {
        console.log(`🔔 Monitored alert ${alertId} deleted`)
      }
    }

    // تسجيل المستمعين
    SmartAlertsService.addEventListener('alert:updated', handleAlertUpdated)
    SmartAlertsService.addEventListener('alert:deleted', handleAlertDeleted)

    return () => {
      // تنظيف المستمعين
      SmartAlertsService.removeEventListener('alert:updated', handleAlertUpdated)
      SmartAlertsService.removeEventListener('alert:deleted', handleAlertDeleted)
    }
  }, [alertId])

  return alert
}
