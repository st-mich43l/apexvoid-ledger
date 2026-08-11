import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { loansRouter } from './routes/loans.js'

const app = express()
const port = process.env.PORT ?? 4000

app.use(cors())
app.use(express.json())

app.use('/api/loans', loansRouter)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(port, () => {
  console.log(`apexvoid-ledger backend listening on port ${port}`)
})
