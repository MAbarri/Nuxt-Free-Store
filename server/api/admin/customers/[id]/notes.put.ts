import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { customerNotesUpdateSchema } from '../../../../schemas/customer.schema'
import { customersService } from '../../../../services/customers.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing customer id' })
  const { notes } = await validateBody(event, customerNotesUpdateSchema)
  return customersService.updateNotes(event, id, notes)
})
