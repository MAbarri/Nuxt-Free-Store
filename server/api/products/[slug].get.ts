import { createError } from 'h3'
import { defineApiHandler } from '../../utils/handler'
import { storefrontCatalogService } from '../../services/storefrontCatalog.service'

export default defineApiHandler(async (event) => {
  const slug = event.context.params?.slug
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing product slug' })

  const product = await storefrontCatalogService.getBySlug(event, slug)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })

  return product
})
