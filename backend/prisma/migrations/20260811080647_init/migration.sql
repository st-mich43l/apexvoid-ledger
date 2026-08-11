-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "openDate" TIMESTAMP(3) NOT NULL,
    "disbursementAmount" DECIMAL(14,2) NOT NULL,
    "interestRatePerYear" DECIMAL(6,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);
