import heapq
from decimal import Decimal
from collections import defaultdict


def compute_net_balances(expenses, settlements):
    """
    Returns a dict of {user_id: net_amount} where:
      positive = user is owed that amount
      negative = user owes that amount
    """
    balances = defaultdict(Decimal)

    for expense in expenses:
        paid_by_id = expense.paid_by_id
        for split in expense.splits.all():
            if split.user_id == paid_by_id:
                continue
            balances[paid_by_id] += split.amount
            balances[split.user_id] -= split.amount

    for s in settlements:
        balances[s.receiver_id] -= s.amount
        balances[s.payer_id] += s.amount

    return {uid: amt for uid, amt in balances.items() if amt != 0}


def simplify_debts(net_balances):
    """
    Greedy debt simplification using two heaps.
    Returns a list of (debtor_id, creditor_id, amount) tuples
    representing the minimum number of transactions to settle all debts.
    """
    # Max-heap for creditors (negate for Python's min-heap)
    creditors = []  # (-amount, user_id)
    # Max-heap for debtors (negate for Python's min-heap)
    debtors = []    # (-amount, user_id)

    for user_id, amount in net_balances.items():
        if amount > 0:
            heapq.heappush(creditors, (-amount, user_id))
        elif amount < 0:
            heapq.heappush(debtors, (amount, user_id))  # already negative

    transactions = []

    while creditors and debtors:
        credit_amt, creditor_id = heapq.heappop(creditors)
        debit_amt, debtor_id = heapq.heappop(debtors)

        credit_amt = -credit_amt  # restore positive
        debit_amt = -debit_amt    # restore positive (amount owed)

        settled = min(credit_amt, debit_amt)
        transactions.append((debtor_id, creditor_id, round(settled, 2)))

        remaining_credit = credit_amt - settled
        remaining_debit = debit_amt - settled

        if remaining_credit > Decimal('0.01'):
            heapq.heappush(creditors, (-remaining_credit, creditor_id))
        if remaining_debit > Decimal('0.01'):
            heapq.heappush(debtors, (-remaining_debit, debtor_id))

    return transactions
