import { defineApiHandler } from '../../utils/handler'
import { validateQuery } from '../../utils/validate'
import { storefrontProductQuerySchema } from '../../schemas/storefront.schema'
import { storefrontCatalogService } from '../../services/storefrontCatalog.service'

export default defineApiHandler(async (event) => {
  const query = validateQuery(event, storefrontProductQuerySchema)
  return storefrontCatalogService.list(event, {
    categorySlug: query.category,
    search: query.search,
    attributeValueIds: query.attributeValueIds,
    sort: query.sort,
    featured: query.featured,
    page: query.page,
    pageSize: query.pageSize,
  })
})
