import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { calculateLoan } from '../lib/loanCalculations.js'

export const loansRouter = Router()

function serializeLoan(loan: {
  id: string
  bankName: string
  openDate: Date
  disbursementAmount: unknown
  interestRatePerYear: unknown
  createdAt: Date
  updatedAt: Date
}) {
  const disbursementAmount = Number(loan.disbursementAmount)
  const interestRatePerYear = Number(loan.interestRatePerYear)

  return {
    id: loan.id,
    bankName: loan.bankName,
    openDate: loan.openDate,
    disbursementAmount,
    interestRatePerYear,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
    ...calculateLoan(disbursementAmount, interestRatePerYear, loan.openDate),
  }
}

loansRouter.get('/', async (_req, res) => {
  const loans = await prisma.loan.findMany({ orderBy: { openDate: 'desc' } })
  res.json(loans.map(serializeLoan))
})

loansRouter.post('/', async (req, res) => {
  const { bankName, openDate, disbursementAmount, interestRatePerYear } = req.body

  if (!bankName || !openDate || disbursementAmount == null || interestRatePerYear == null) {
    res.status(400).json({ error: 'bankName, openDate, disbursementAmount, and interestRatePerYear are required' })
    return
  }

  const loan = await prisma.loan.create({
    data: {
      bankName,
      openDate: new Date(openDate),
      disbursementAmount,
      interestRatePerYear,
    },
  })

  res.status(201).json(serializeLoan(loan))
})

loansRouter.put('/:id', async (req, res) => {
  const { bankName, openDate, disbursementAmount, interestRatePerYear } = req.body

  const loan = await prisma.loan.update({
    where: { id: req.params.id },
    data: {
      ...(bankName != null && { bankName }),
      ...(openDate != null && { openDate: new Date(openDate) }),
      ...(disbursementAmount != null && { disbursementAmount }),
      ...(interestRatePerYear != null && { interestRatePerYear }),
    },
  })

  res.json(serializeLoan(loan))
})

loansRouter.delete('/:id', async (req, res) => {
  await prisma.loan.delete({ where: { id: req.params.id } })
  res.status(204).send()
})
