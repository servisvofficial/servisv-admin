import { useCallback, useEffect, useRef, useState } from 'react'
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
  }>
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

export type UsersStats = {
  total: number
  activeProviders: number
  pendingProviders: number
  bannedUsers: number
  totalProviders: number
}

export type TopCategory = {
  category: string
  count: number
}

export type UseUsersDataOptions = {
  page?: number
  pageSize?: number
  search?: string
}

export type UseUsersDataState = {
  data: UserRecord[]
  totalCount: number
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  stats?: UsersStats
  topCategories?: TopCategory[]
}

function groupServicesByUser(
  servicesData: any[]
): Map<string, Array<{ category: string; subcategories: string[] }>> {
  const categoriesByUser = new Map<string, Map<string, string[]>>()

  servicesData.forEach((service: any) => {
    const userId = service.user_id
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

  const result = new Map<string, Array<{ category: string; subcategories: string[] }>>()
  categoriesByUser.forEach((catMap, userId) => {
    result.set(
      userId,
      Array.from(catMap.entries()).map(([category, subcategories]) => ({
        category,
        subcategories,
      }))
    )
  })

  return result
}

export function useUsersData(options?: UseUsersDataOptions): UseUsersDataState {
  const [data, setData] = useState<UserRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<UsersStats | undefined>(undefined)
  const [topCategories, setTopCategories] = useState<TopCategory[] | undefined>(undefined)

  const page = options?.page
  const pageSize = options?.pageSize
  const search = options?.search
  const isPaginated = page !== undefined || pageSize !== undefined || search !== undefined

  const isFetchingStatsRef = useRef(false)

  const fetchStatsAndTopCategories = useCallback(async () => {
    if (isFetchingStatsRef.current) return
    isFetchingStatsRef.current = true

    try {
      // 1. Conteo de estadísticas generales en paralelo
      const [totalRes, activeRes, pendingRes, bannedRes, totalProvidersRes] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('is_provider', true)
          .eq('is_validated', true),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('is_provider', true)
          .eq('is_validated', false),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_banned', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_provider', true),
      ])

      setStats({
        total: totalRes.count ?? 0,
        activeProviders: activeRes.count ?? 0,
        pendingProviders: pendingRes.count ?? 0,
        bannedUsers: bannedRes.count ?? 0,
        totalProviders: totalProvidersRes.count ?? 0,
      })

      // 2. Obtener categorías con más proveedores paginando user_professional_services
      let allUps: any[] = []
      const CHUNK_SIZE = 1000
      let from = 0
      while (true) {
        const { data: chunk, error: chunkErr } = await supabase
          .from('user_professional_services')
          .select('user_id, category_id, categories(name)')
          .range(from, from + CHUNK_SIZE - 1)

        if (chunkErr || !chunk || chunk.length === 0) break
        allUps.push(...chunk)
        if (chunk.length < CHUNK_SIZE) break
        from += CHUNK_SIZE
      }

      const categoryUsers = new Map<string, Set<string>>()
      allUps.forEach((row) => {
        const catName = row.categories?.name
        if (!catName) return
        if (!categoryUsers.has(catName)) categoryUsers.set(catName, new Set())
        categoryUsers.get(catName)!.add(row.user_id)
      })

      const top = Array.from(categoryUsers.entries())
        .map(([category, set]) => ({ category, count: set.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)

      setTopCategories(top)
    } catch (err) {
      console.error('Error al cargar stats y categorías:', err)
    } finally {
      isFetchingStatsRef.current = false
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (isPaginated) {
        const currentPage = Math.max(1, page ?? 1)
        const limit = pageSize ?? 20
        const from = (currentPage - 1) * limit
        const to = from + limit - 1

        let query = supabase
          .from('users')
          .select(
            `id,name,last_name,rol,email,location,is_provider,is_validated,is_banned,
            police_clearance_verified,police_clearance_pic,
            professional_credential_verified,professional_credential_pic,
            dui_frontal_pic,
            dui_dorso_pic,
            dui,
            created_at,rating,total_requests,total_quotes,description,profile_pic`,
            { count: 'exact' }
          )
          .order('created_at', { ascending: false })

        const trimmed = search?.trim()
        if (trimmed) {
          const words = trimmed.split(/\s+/).filter(Boolean)
          for (const w of words) {
            query = query.or(
              `name.ilike.%${w}%,last_name.ilike.%${w}%,email.ilike.%${w}%,dui.ilike.%${w}%`
            )
          }
        }

        const { data: pageUsers, count, error: queryError } = await query.range(from, to)

        if (queryError) {
          setError(queryError.message)
          setLoading(false)
          return
        }

        if (!pageUsers || pageUsers.length === 0) {
          setData([])
          setTotalCount(count ?? 0)
          setLoading(false)
          return
        }

        setTotalCount(count ?? 0)

        // Cargar categorías SOLO para los usuarios de la página actual
        const pageUserIds = pageUsers.map((u) => u.id)
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
          .in('user_id', pageUserIds)

        if (servicesError) {
          console.error('Error al cargar servicios profesionales de la página:', servicesError)
        }

        const servicesMap = groupServicesByUser(servicesData || [])
        const enriched = pageUsers.map((user) => ({
          ...user,
          serviceCategories: servicesMap.get(user.id) || [],
        }))

        setData(enriched as UserRecord[])
        setLoading(false)
      } else {
        // Modo sin paginación (para compatibilidad con otras páginas)
        const { data: allUsers, error: usersError } = await supabase
          .from('users')
          .select(
            `id,name,last_name,rol,email,location,is_provider,is_validated,is_banned,
            police_clearance_verified,police_clearance_pic,
            professional_credential_verified,professional_credential_pic,
            dui_frontal_pic,
            dui_dorso_pic,
            dui,
            created_at,rating,total_requests,total_quotes,description,profile_pic`
          )
          .order('created_at', { ascending: false })

        if (usersError) {
          setError(usersError.message)
          setLoading(false)
          return
        }

        if (!allUsers) {
          setData([])
          setTotalCount(0)
          setLoading(false)
          return
        }

        // Cargar TODOS los servicios con paginación para superar el límite de 1000 filas de PostgREST
        let allServices: any[] = []
        const CHUNK_SIZE = 1000
        let svcFrom = 0
        while (true) {
          const { data: chunk, error: chunkErr } = await supabase
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
            .range(svcFrom, svcFrom + CHUNK_SIZE - 1)

          if (chunkErr || !chunk || chunk.length === 0) break
          allServices.push(...chunk)
          if (chunk.length < CHUNK_SIZE) break
          svcFrom += CHUNK_SIZE
        }

        const servicesMap = groupServicesByUser(allServices)
        const enriched = allUsers.map((user) => ({
          ...user,
          serviceCategories: servicesMap.get(user.id) || [],
        }))

        setData(enriched as UserRecord[])
        setTotalCount(enriched.length)
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
      setLoading(false)
    }
  }, [isPaginated, page, pageSize, search])

  // Cargar usuarios cuando cambian los filtros/paginación
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Cargar estadísticas y top categorías
  useEffect(() => {
    if (isPaginated) {
      fetchStatsAndTopCategories()
    }
  }, [isPaginated, fetchStatsAndTopCategories])

  const refetch = useCallback(async () => {
    await Promise.all([
      fetchUsers(),
      isPaginated ? fetchStatsAndTopCategories() : Promise.resolve(),
    ])
  }, [fetchUsers, isPaginated, fetchStatsAndTopCategories])

  return { data, totalCount, loading, error, refetch, stats, topCategories }
}
