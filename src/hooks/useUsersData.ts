import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type UserRecord = {
  id: string
  name: string
  last_name: string
  rol: 'user' | 'provider'
  email: string
  location: string | null
  is_provider: boolean
  is_validated: boolean
  is_banned: boolean
  serviceCategories?: Array<{
    category: string
    subcategories: string[]
  }> // Categorías con nombres y subcategorías
  police_clearance_verified: boolean
  professional_credential_verified: boolean
  police_clearance_pic?: string | null
  professional_credential_pic?: string | null
  dui_frontal_pic?: string | null
  dui_dorso_pic?: string | null
  dui?: string | null
  created_at: string
  rating: number | null
  total_requests: number | null
  total_quotes: number | null
  description?: string | null
  profile_pic?: string | null
}

type UseUsersDataState = {
  data: UserRecord[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useUsersData(): UseUsersDataState {
  const [data, setData] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('users')
      .select(
        `id,name,last_name,rol,email,location,is_provider,is_validated,is_banned,
        police_clearance_verified,police_clearance_pic,
        professional_credential_verified,professional_credential_pic,
        dui_frontal_pic,
        dui_dorso_pic,
        dui,
        created_at,rating,total_requests,total_quotes,description,profile_pic`,
      )
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data) {
      setData([])
      setLoading(false)
      return
    }

    // Cargar categorías y subcategorías desde user_professional_services con JOINs
    const userIds = data.map((user) => user.id)
    const { data: servicesData, error: servicesError } = await supabase
      .from('user_professional_services')
      .select(
        `
        user_id,
        category_id,
        subcategory_id,
        categories (id, name),
        subcategories (id, name)
      `
      )
      .in('user_id', userIds)

    if (servicesError) {
      console.error("Error al cargar servicios profesionales:", servicesError);
    }

    // Agrupar categorías y subcategorías por usuario
    const categoriesByUser = new Map<
      string,
      Map<string, string[]>
    >()
    if (servicesData) {
      servicesData.forEach((service: any) => {
        const userId = service.user_id
        // Supabase retorna objetos cuando hay foreign keys
        const categoryName = service.categories?.name || null
        const subcategoryName = service.subcategories?.name || null

        if (!categoryName) return

        if (!categoriesByUser.has(userId)) {
          categoriesByUser.set(userId, new Map())
        }

        const userCategories = categoriesByUser.get(userId)!
        if (!userCategories.has(categoryName)) {
          userCategories.set(categoryName, [])
        }

        if (subcategoryName) {
          const subcategories = userCategories.get(categoryName)!
          if (!subcategories.includes(subcategoryName)) {
            subcategories.push(subcategoryName)
          }
        }
      })
    }

    // Enriquecer usuarios con serviceCategories (nombres de categorías y subcategorías)
    const enriched = data.map((user) => {
      const userCategoriesMap = categoriesByUser.get(user.id)
      const serviceCategories = userCategoriesMap
        ? Array.from(userCategoriesMap.entries()).map(([category, subcategories]) => ({
            category,
            subcategories,
          }))
        : []

      return {
        ...user,
        serviceCategories,
      }
    })

    setData(enriched as UserRecord[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      fetchUsers()
    }, 0)
    return () => clearTimeout(id)
  }, [fetchUsers])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    await fetchUsers()
  }, [fetchUsers])

  return { data, loading, error, refetch }
}

