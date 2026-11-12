import { createError } from 'h3'
import { defineApiHandler } from '../../utils/handler'
import { storefrontCategoriesService } from '../../services/storefrontCategories.service'

export default defineApiHandler(async (event) => {
  const slug = event.context.params?.slug
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing category slug' })

  const category = await storefrontCategoriesService.getBySlug(event, slug)
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found' })

  return category
})
