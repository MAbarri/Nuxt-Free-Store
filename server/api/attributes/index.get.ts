import { defineApiHandler } from '../../utils/handler'
import { attributesRepository } from '../../repositories/attributes.repository'

/** Public: attribute + value metadata, used by the storefront for filters and swatches. */
export default defineApiHandler(async (event) => {
  return attributesRepository.list(event)
})
