import { defineApiHandler } from '../../utils/handler'
import { getAuthUser } from '../../utils/session'

export default defineApiHandler(async (event) => {
  const user = await getAuthUser(event)
  return { user }
})
