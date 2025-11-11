import { create } from 'zustand'
import { DentalTreatmentImage, ToothTreatment } from '@/types'

// آلية تخزين مؤقت بسيطة
interface CacheEntry<T> {
  data: T
  timestamp: number
}

interface TreatmentCache {
  [patientId: string]: CacheEntry<ToothTreatment[]>
}

// مدة صلاحية الكاش: 5 دقائق
const CACHE_DURATION = 5 * 60 * 1000

interface DentalTreatmentState {
  toothTreatments: ToothTreatment[] // Multiple treatments per tooth
  images: DentalTreatmentImage[]
  toothTreatmentImages: any[] // Images for tooth treatments
  isLoading: boolean
  error: string | null
  selectedPatientId: string | null
  selectedToothNumber: number | null
  // كاش للعلاجات حسب المريض
  treatmentCache: TreatmentCache

  // Multiple treatments actions
  loadToothTreatments: () => Promise<void>
  loadToothTreatmentsByPatient: (patientId: string) => Promise<void>
  loadToothTreatmentsByTooth: (patientId: string, toothNumber: number) => Promise<void>
  loadToothTreatmentsByAppointment: (appointmentId: string) => Promise<ToothTreatment[]>
  createToothTreatment: (treatment: Omit<ToothTreatment, 'id' | 'created_at' | 'updated_at'>) => Promise<ToothTreatment>
  updateToothTreatment: (id: string, updates: Partial<ToothTreatment>) => Promise<void>
  deleteToothTreatment: (id: string) => Promise<void>
  reorderToothTreatments: (patientId: string, toothNumber: number, treatmentIds: string[]) => Promise<void>

  // Tooth Treatment Images actions
  loadAllToothTreatmentImages: () => Promise<void>
  loadToothTreatmentImagesByTreatment: (treatmentId: string) => Promise<void>
  loadToothTreatmentImagesByTooth: (patientId: string, toothNumber: number) => Promise<void>
  loadAllToothTreatmentImagesByPatient: (patientId: string) => Promise<void>
  createToothTreatmentImage: (image: any) => Promise<any>
  deleteToothTreatmentImage: (id: string) => Promise<void>
  clearToothTreatmentImages: () => void

  // Legacy Image actions (for dental_treatment_images table)
  loadImages: () => Promise<void>
  loadImagesByTreatment: (treatmentId: string) => Promise<void>
  createImage: (image: Omit<DentalTreatmentImage, 'id' | 'created_at' | 'updated_at'>) => Promise<DentalTreatmentImage>
  deleteImage: (id: string) => Promise<void>
  refreshAllImages: () => Promise<void>
  clearImages: () => void

  // Utility actions
  setSelectedPatient: (patientId: string | null) => void
  setSelectedTooth: (toothNumber: number | null) => void
  clearError: () => void
}

export const useDentalTreatmentStore = create<DentalTreatmentState>((set, get) => ({
  toothTreatments: [], // Multiple treatments per tooth
  images: [],
  toothTreatmentImages: [], // Images for tooth treatments
  isLoading: false,
  error: null,
  selectedPatientId: null,
  selectedToothNumber: null,
  treatmentCache: {},

  // Multiple treatments per tooth actions
  loadToothTreatments: async () => {
    set({ isLoading: true, error: null })
    try {
      const toothTreatments = await window.electronAPI.toothTreatments.getAll()
      set({ toothTreatments, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tooth treatments',
        isLoading: false
      })
    }
  },

  loadToothTreatmentsByPatient: async (patientId: string) => {
    console.log('🦷 [STORE] loadToothTreatmentsByPatient called for:', patientId)
    
    // ✅ FIX: Clear stale cache for this patient to ensure fresh data
    const state = get()
    const cachedEntry = state.treatmentCache[patientId]
    const now = Date.now()

    // إذا كانت البيانات موجودة في الكاش وما زالت صالحة
    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION) {
      console.log('🦷 [STORE] Using cached treatments for patient:', patientId, '- Age:', Math.round((now - cachedEntry.timestamp) / 1000), 'seconds')
      set({
        toothTreatments: cachedEntry.data,
        isLoading: false,
        selectedPatientId: patientId
      })

      // إرسال حدث لتحديث الألوان حتى عند استخدام الكاش
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('treatments-loaded', {
          detail: { patientId, treatmentsCount: cachedEntry.data.length, fromCache: true }
        }))
      }
      return
    }

    set({ isLoading: true, error: null })
    try {
      console.log('🦷 [STORE] Loading treatments from database for patient:', patientId)
      
      // ✅ FIX: Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Treatment loading timeout')), 10000)
      )
      
      const loadPromise = window.electronAPI.toothTreatments.getByPatient(patientId)
      
      const toothTreatments = await Promise.race([loadPromise, timeoutPromise]) as any[]
      
      console.log('🦷 [STORE] Successfully loaded', toothTreatments.length, 'treatments for patient:', patientId)

      // تحديث الكاش
      const updatedCache = {
        ...state.treatmentCache,
        [patientId]: {
          data: toothTreatments,
          timestamp: now
        }
      }

      set({
        toothTreatments,
        isLoading: false,
        selectedPatientId: patientId,
        treatmentCache: updatedCache
      })

      // إرسال حدث لتحديث الألوان
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('treatments-loaded', {
          detail: { patientId, treatmentsCount: toothTreatments.length, fromCache: false }
        }))
      }
    } catch (error) {
      console.error('🦷 [STORE] Error loading treatments for patient:', patientId, error)
      console.error('🦷 [STORE] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      
      // ✅ FIX: Set empty array instead of keeping old data
      set({
        toothTreatments: [],
        error: error instanceof Error ? error.message : 'Failed to load patient tooth treatments',
        isLoading: false
      })
      
      // ✅ FIX: Show user-friendly error notification
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('treatment-load-error', {
          detail: { 
            patientId, 
            error: error instanceof Error ? error.message : 'Failed to load treatments'
          }
        }))
      }
    }
  },

  loadToothTreatmentsByTooth: async (patientId: string, toothNumber: number) => {
    set({ isLoading: true, error: null })
    try {
      const toothTreatments = await window.electronAPI.toothTreatments.getByTooth(patientId, toothNumber)
      set({
        toothTreatments,
        isLoading: false,
        selectedPatientId: patientId,
        selectedToothNumber: toothNumber
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tooth treatments',
        isLoading: false
      })
    }
  },

  loadToothTreatmentsByAppointment: async (appointmentId: string) => {
    set({ isLoading: true, error: null })
    try {
      const toothTreatments = await window.electronAPI.toothTreatments.getByAppointment(appointmentId)
      set({
        toothTreatments,
        isLoading: false
      })
      return toothTreatments
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tooth treatments by appointment',
        isLoading: false
      })
      return []
    }
  },

  createToothTreatment: async (treatmentData) => {
    set({ isLoading: true, error: null })
    try {
      const newTreatment = await window.electronAPI.toothTreatments.create(treatmentData)
      const { toothTreatments, selectedPatientId, treatmentCache } = get()

      // مسح الكاش للمريض المعني
      const updatedCache = { ...treatmentCache }
      if (treatmentData.patient_id) {
        delete updatedCache[treatmentData.patient_id]
      }

      // Add the new treatment to the local state
      set({
        toothTreatments: [...toothTreatments, newTreatment],
        isLoading: false,
        treatmentCache: updatedCache
      })

      // Reload all treatments for the patient to ensure consistency
      if (selectedPatientId) {
        const refreshedTreatments = await window.electronAPI.toothTreatments.getByPatient(selectedPatientId)
        set({ toothTreatments: refreshedTreatments })
      }

      // Emit events for real-time sync
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('treatment-added', {
          detail: {
            type: 'created',
            treatmentId: newTreatment.id,
            treatment: newTreatment
          }
        }))
        window.dispatchEvent(new CustomEvent('treatment-changed', {
          detail: {
            type: 'created',
            treatmentId: newTreatment.id,
            treatment: newTreatment
          }
        }))
      }

      return newTreatment
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create tooth treatment',
        isLoading: false
      })
      throw error
    }
  },

  updateToothTreatment: async (id: string, updates: Partial<ToothTreatment>) => {
    set({ isLoading: true, error: null })
    try {
      console.log('🦷 Store: Updating treatment in database:', id, updates)
      await window.electronAPI.toothTreatments.update(id, updates)
      console.log('🦷 Store: Database update successful')

      const { toothTreatments, selectedPatientId, treatmentCache } = get()

      // العثور على العلاج المحدث لمسح الكاش الخاص بمريضه
      const updatedTreatment = toothTreatments.find(t => t.id === id)
      const updatedCache = { ...treatmentCache }
      if (updatedTreatment?.patient_id) {
        delete updatedCache[updatedTreatment.patient_id]
      }

      // Update the treatment in the local state
      const updatedTreatments = toothTreatments.map(treatment =>
        treatment.id === id ? { ...treatment, ...updates, updated_at: new Date().toISOString() } : treatment
      )
      set({
        toothTreatments: updatedTreatments,
        isLoading: false,
        treatmentCache: updatedCache
      })

      // Optionally reload all treatments for the patient to ensure consistency
      if (selectedPatientId) {
        try {
          const refreshedTreatments = await window.electronAPI.toothTreatments.getByPatient(selectedPatientId)
          // تحديث الكاش مع البيانات الجديدة
          const newCache = {
            ...updatedCache,
            [selectedPatientId]: {
              data: refreshedTreatments,
              timestamp: Date.now()
            }
          }
          set({
            toothTreatments: refreshedTreatments,
            treatmentCache: newCache
          })
          console.log('🦷 Store: Refreshed treatments from database')
        } catch (refreshError) {
          console.warn('🦷 Store: Failed to refresh treatments, but update was successful:', refreshError)
          // لا نرمي خطأ هنا لأن التحديث الأساسي نجح
        }
      }

      // Emit events for real-time sync
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('treatment-updated', {
          detail: {
            type: 'updated',
            treatmentId: id,
            updates: updates
          }
        }))
        window.dispatchEvent(new CustomEvent('treatment-changed', {
          detail: {
            type: 'updated',
            treatmentId: id,
            updates: updates
          }
        }))

        // إرسال حدث خاص لتحديث ألوان الأسنان فوراً
        window.dispatchEvent(new CustomEvent('tooth-color-update', {
          detail: {
            type: 'status-changed',
            treatmentId: id,
            updates: updates,
            timestamp: Date.now()
          }
        }))
      }

      console.log('🦷 Store: Treatment update completed successfully')
    } catch (error) {
      console.error('🦷 Store: Error updating treatment:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to update tooth treatment',
        isLoading: false
      })
      // لا نرمي الخطأ إذا كان التحديث نجح في قاعدة البيانات
      // throw error
    }
  },

  deleteToothTreatment: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await window.electronAPI.toothTreatments.delete(id)
      const { toothTreatments, treatmentCache } = get()

      // العثور على العلاج المحذوف لمسح الكاش الخاص بمريضه
      const deletedTreatment = toothTreatments.find(t => t.id === id)
      const updatedCache = { ...treatmentCache }
      if (deletedTreatment?.patient_id) {
        delete updatedCache[deletedTreatment.patient_id]
      }

      set({
        toothTreatments: toothTreatments.filter(treatment => treatment.id !== id),
        isLoading: false,
        treatmentCache: updatedCache
      })

      // Emit events for real-time sync
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('treatment-deleted', {
          detail: {
            type: 'deleted',
            treatmentId: id
          }
        }))
        window.dispatchEvent(new CustomEvent('treatment-changed', {
          detail: {
            type: 'deleted',
            treatmentId: id
          }
        }))
        // Emit event for payment store to update
        window.dispatchEvent(new CustomEvent('treatment-payments-deleted', {
          detail: {
            treatmentId: id
          }
        }))
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete tooth treatment',
        isLoading: false
      })
      throw error
    }
  },

  reorderToothTreatments: async (patientId: string, toothNumber: number, treatmentIds: string[]) => {
    set({ isLoading: true, error: null })
    try {
      await window.electronAPI.toothTreatments.reorder(patientId, toothNumber, treatmentIds)

      // Reload treatments for this tooth to get updated priorities
      const refreshedTreatments = await window.electronAPI.toothTreatments.getByTooth(patientId, toothNumber)
      const { toothTreatments } = get()

      // Update only the treatments for this specific tooth
      const updatedTreatments = toothTreatments.map(treatment => {
        if (treatment.patient_id === patientId && treatment.tooth_number === toothNumber) {
          const refreshed = refreshedTreatments.find(rt => rt.id === treatment.id)
          return refreshed || treatment
        }
        return treatment
      })

      set({ toothTreatments: updatedTreatments, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reorder tooth treatments',
        isLoading: false
      })
      throw error
    }
  },

  loadImages: async () => {
    set({ isLoading: true, error: null })
    try {
      const images = await window.electronAPI.dentalTreatmentImages.getAll()
      set({ images, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load images',
        isLoading: false
      })
    }
  },

  loadImagesByTreatment: async (treatmentId: string) => {
    set({ isLoading: true, error: null })
    try {
      const images = await window.electronAPI.dentalTreatmentImages.getByTreatment(treatmentId)
      set({ images, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load treatment images',
        isLoading: false
      })
    }
  },

  createImage: async (imageData) => {
    set({ isLoading: true, error: null })
    try {
      const newImage = await window.electronAPI.dentalTreatmentImages.create(imageData)
      const { images } = get()
      set({
        images: [...images, newImage],
        isLoading: false
      })
      return newImage
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create image',
        isLoading: false
      })
      throw error
    }
  },

  deleteImage: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await window.electronAPI.dentalTreatmentImages.delete(id)
      const { images } = get()
      const filteredImages = images.filter(image => image.id !== id)
      set({ images: filteredImages, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete image',
        isLoading: false
      })
    }
  },

  refreshAllImages: async () => {
    set({ isLoading: true, error: null })
    try {
      const images = await window.electronAPI.dentalTreatmentImages.getAll()
      set({ images, isLoading: false })
      console.log('✅ All images refreshed after backup restore')
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh images',
        isLoading: false
      })
    }
  },

  clearImages: () => {
    set({ images: [] })
  },



  setSelectedPatient: (patientId: string | null) => {
    set({ selectedPatientId: patientId })
  },

  setSelectedTooth: (toothNumber: number | null) => {
    set({ selectedToothNumber: toothNumber })
  },

  clearError: () => {
    set({ error: null })
  },

  // NEW: Tooth Treatment Images actions
  loadAllToothTreatmentImages: async () => {
    set({ isLoading: true, error: null })
    try {
      const allImages = await window.electronAPI.toothTreatmentImages.getAll()
      set({ toothTreatmentImages: allImages, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load all tooth treatment images',
        isLoading: false
      })
    }
  },

  loadToothTreatmentImagesByTreatment: async (treatmentId: string) => {
    set({ isLoading: true, error: null })
    try {
      const images = await window.electronAPI.toothTreatmentImages.getByTreatment(treatmentId)
      set({ toothTreatmentImages: images, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tooth treatment images',
        isLoading: false
      })
    }
  },

  loadToothTreatmentImagesByTooth: async (patientId: string, toothNumber: number) => {
    set({ isLoading: true, error: null })
    try {
      const newImages = await window.electronAPI.toothTreatmentImages.getByTooth(patientId, toothNumber)
      const { toothTreatmentImages } = get()

      // Remove existing images for this tooth and patient, then add new ones
      const filteredImages = toothTreatmentImages.filter(img =>
        !(img.tooth_number === toothNumber && img.patient_id === patientId)
      )

      set({
        toothTreatmentImages: [...filteredImages, ...newImages],
        isLoading: false
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tooth treatment images',
        isLoading: false
      })
    }
  },

  createToothTreatmentImage: async (imageData: any) => {
    set({ isLoading: true, error: null })
    try {
      const newImage = await window.electronAPI.toothTreatmentImages.create(imageData)
      const { toothTreatmentImages } = get()
      set({
        toothTreatmentImages: [...toothTreatmentImages, newImage],
        isLoading: false
      })
      return newImage
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create tooth treatment image',
        isLoading: false
      })
      throw error
    }
  },

  deleteToothTreatmentImage: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await window.electronAPI.toothTreatmentImages.delete(id)
      const { toothTreatmentImages } = get()
      set({
        toothTreatmentImages: toothTreatmentImages.filter(img => img.id !== id),
        isLoading: false
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete tooth treatment image',
        isLoading: false
      })
      throw error
    }
  },

  clearToothTreatmentImages: () => {
    set({ toothTreatmentImages: [] })
  },

  loadAllToothTreatmentImagesByPatient: async (patientId: string) => {
    set({ isLoading: true, error: null })
    try {
      // Get all images for this patient from all teeth
      const allImages = await window.electronAPI.toothTreatmentImages.getAll()
      const patientImages = allImages.filter(img => img.patient_id === patientId)

      set({
        toothTreatmentImages: patientImages,
        isLoading: false
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load all tooth treatment images',
        isLoading: false
      })
    }
  }
}))
