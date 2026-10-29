import enum


class TransactionType(enum.StrEnum):
    INCOME = "income"
    EXPENSE = "expense"


class PaymentMethod(enum.StrEnum):
    CASH = "cash"
    CARD = "card"
    BANK = "bank"
    UPI = "upi"
    OTHER = "other"
