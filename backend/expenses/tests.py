from decimal import Decimal
from django.test import TestCase
from .balance_engine import compute_net_balances, simplify_debts


class SimplifyDebtsTest(TestCase):

    def test_simple_two_person(self):
        # A owes B $10
        net = {1: Decimal('10'), 2: Decimal('-10')}
        txns = simplify_debts(net)
        self.assertEqual(len(txns), 1)
        debtor, creditor, amount = txns[0]
        self.assertEqual(debtor, 2)
        self.assertEqual(creditor, 1)
        self.assertEqual(amount, Decimal('10'))

    def test_three_person_simplification(self):
        # Without simplification: A→B $10, B→C $10 (2 transactions)
        # With simplification:    A→C $10 (1 transaction)
        net = {
            1: Decimal('10'),   # A is owed $10
            2: Decimal('0'),    # B breaks even
            3: Decimal('-10'),  # C owes $10
        }
        txns = simplify_debts({k: v for k, v in net.items() if v != 0})
        self.assertEqual(len(txns), 1)

    def test_complex_group(self):
        # 4 people, multiple debts — should produce minimal transactions
        net = {
            1: Decimal('30'),
            2: Decimal('10'),
            3: Decimal('-20'),
            4: Decimal('-20'),
        }
        txns = simplify_debts(net)
        # Verify all debts are settled (sum of debtor payments = sum of creditor receipts)
        total_paid = sum(amt for _, _, amt in txns)
        self.assertEqual(round(total_paid, 2), Decimal('40'))
        # Should be at most 3 transactions for 4 people
        self.assertLessEqual(len(txns), 3)

    def test_already_settled(self):
        net = {}
        txns = simplify_debts(net)
        self.assertEqual(txns, [])

    def test_uneven_split(self):
        # $10 split 3 ways: two owe $3.33, one is owed $6.66
        net = {
            1: Decimal('6.66'),
            2: Decimal('-3.33'),
            3: Decimal('-3.33'),
        }
        txns = simplify_debts(net)
        self.assertEqual(len(txns), 2)
