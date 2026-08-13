from datetime import datetime, timezone
from decimal import Decimal

from app.calculations import build_loan_detail, calculate_loan, generate_loan_schedule


def dt(year: int, month: int, day: int) -> datetime:
  return datetime(year, month, day, tzinfo=timezone.utc)


class TestUnsecuredEmiSchedule:
  def test_emi_is_constant_except_the_trued_up_final_installment(self):
    schedule = generate_loan_schedule(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=dt(2026, 5, 7)
    )
    payments = {item.payment for item in schedule.items[:-1]}
    assert payments == {schedule.monthly_payment}
    # The final installment is trued up to whatever's left rather than
    # forced to equal the EMI - actual/365 day-count interest doesn't
    # divide evenly against the closed-form EMI formula's assumption of
    # uniform monthly compounding, and that drift accumulates over the
    # full term. A bank's real final payment is "whatever clears the
    # balance," not "the same as every other payment" - the true test of
    # correctness is that it actually clears the balance (see
    # test_final_principal_reaches_zero), not that it's numerically
    # close to the EMI.
    final = schedule.items[-1]
    assert final.payment > 0
    assert final.principal == final.opening_principal

  def test_principal_grows_and_interest_shrinks_over_time(self):
    schedule = generate_loan_schedule(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=dt(2026, 5, 7)
    )
    first, second, third = schedule.items[0], schedule.items[1], schedule.items[2]
    # Interest generally decreases and principal generally increases as the
    # outstanding balance declines (calendar-day variation can perturb a
    # single step, but the trend across a few periods should hold).
    assert third.interest < first.interest
    assert third.principal > first.principal
    assert second.opening_principal < first.opening_principal

  def test_closing_principal_declines_monotonically(self):
    schedule = generate_loan_schedule(
      Decimal("100000000"), Decimal("8"), dt(2026, 1, 1), 24, "unsecured", as_of=dt(2026, 1, 1)
    )
    balances = [item.closing_principal for item in schedule.items]
    assert all(earlier >= later for earlier, later in zip(balances, balances[1:]))

  def test_matches_real_world_bank_reference(self):
    # Verified against an actual Shinhan/SmartCredit unsecured loan
    # statement: 596,000,000 VND, 12%/yr, 60mo, opened 2026-05-07, with
    # exactly 3 installments elapsed (Jun 8 / Jul 7 / Aug 7 - the first
    # is pushed off its Sunday nominal date). Real bank outstanding
    # balance: 574,038,167.
    calc = calculate_loan(
      Decimal("596000000"),
      Decimal("12"),
      dt(2026, 5, 7),
      60,
      "unsecured",
      as_of=dt(2026, 8, 11),
    )
    assert calc.current_balance == Decimal("574038167")

  def test_individual_installments_match_real_world_bank_reference(self):
    schedule = generate_loan_schedule(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=dt(2026, 8, 11)
    )
    first, second, third = schedule.items[0], schedule.items[1], schedule.items[2]
    assert first.principal == Decimal("6987444")
    assert second.principal == Decimal("7641900")
    assert third.principal == Decimal("7332489")
    assert first.status == second.status == third.status == "completed"

  def test_final_principal_reaches_zero(self):
    schedule = generate_loan_schedule(
      Decimal("100000000"), Decimal("9.5"), dt(2026, 1, 1), 36, "unsecured", as_of=dt(2026, 1, 1)
    )
    assert schedule.items[-1].closing_principal == Decimal("0")

  def test_final_principal_reaches_zero_with_odd_amount(self):
    # A principal that doesn't divide evenly by the term count is the
    # real stress case for cumulative per-period rounding.
    schedule = generate_loan_schedule(
      Decimal("123456789"), Decimal("17.25"), dt(2026, 3, 15), 47, "unsecured", as_of=dt(2026, 3, 15)
    )
    assert schedule.items[-1].closing_principal == Decimal("0")

  def test_calculate_loan_reports_zero_balance_once_matured(self):
    calc = calculate_loan(
      Decimal("50000000"), Decimal("10"), dt(2020, 1, 1), 12, "unsecured", as_of=dt(2030, 1, 1)
    )
    assert calc.current_balance == Decimal("0")
    assert calc.is_matured is True


class TestSecuredFixedBalance:
  def test_principal_never_declines(self):
    schedule = generate_loan_schedule(
      Decimal("150000000"), Decimal("22.99"), dt(2026, 5, 7), 60, "secured", as_of=dt(2026, 5, 7)
    )
    assert all(item.opening_principal == Decimal("150000000") for item in schedule.items)
    assert all(item.closing_principal == Decimal("150000000") for item in schedule.items)
    assert all(item.principal == Decimal("0") for item in schedule.items)

  def test_interest_accrues_on_the_full_principal_each_period(self):
    schedule = generate_loan_schedule(
      Decimal("150000000"), Decimal("22.99"), dt(2026, 5, 7), 60, "secured", as_of=dt(2026, 5, 7)
    )
    assert all(item.interest > 0 for item in schedule.items)

  def test_visualization_reflects_fixed_not_amortizing_balance(self):
    # The point of the secured/fixed model: unlike unsecured, the balance
    # doesn't decline term over term - it's flat until (conceptually)
    # cleared at maturity, which this app doesn't model as an event.
    schedule = generate_loan_schedule(
      Decimal("150000000"), Decimal("22.99"), dt(2026, 5, 7), 60, "secured", as_of=dt(2026, 5, 7)
    )
    closing_balances = {item.closing_principal for item in schedule.items}
    assert closing_balances == {Decimal("150000000")}


class TestZeroInterestLoan:
  def test_unsecured_zero_interest_splits_principal_evenly(self):
    schedule = generate_loan_schedule(
      Decimal("120000000"), Decimal("0"), dt(2026, 1, 1), 12, "unsecured", as_of=dt(2026, 1, 1)
    )
    assert all(item.interest == Decimal("0") for item in schedule.items)
    assert schedule.monthly_payment == Decimal("10000000")
    assert schedule.items[-1].closing_principal == Decimal("0")

  def test_secured_zero_interest_has_no_cost_and_flat_balance(self):
    schedule = generate_loan_schedule(
      Decimal("120000000"), Decimal("0"), dt(2026, 1, 1), 12, "secured", as_of=dt(2026, 1, 1)
    )
    assert all(item.interest == Decimal("0") for item in schedule.items)
    assert all(item.closing_principal == Decimal("120000000") for item in schedule.items)


class TestDueDateScheduling:
  def test_weekend_due_date_moves_to_monday(self):
    schedule = generate_loan_schedule(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=dt(2026, 5, 7)
    )
    # 2026-06-07 (the nominal 1-month anniversary) is a Sunday.
    assert schedule.items[0].due_date == dt(2026, 6, 8)
    assert schedule.items[0].due_date.weekday() == 0  # Monday

  def test_month_length_transitions_28_29_30_31(self):
    # Opened on the 31st: Feb (28 days, non-leap) clamps to the 28th,
    # then March and April correctly go back to the 31st/30th of the
    # target month rather than drifting from the clamped date.
    schedule = generate_loan_schedule(
      Decimal("60000000"), Decimal("6"), dt(2026, 1, 31), 3, "unsecured", as_of=dt(2026, 1, 31)
    )
    # Nominal Feb 28 (Sat) pushes to Mar 2 (Mon).
    assert schedule.items[0].due_date == dt(2026, 3, 2)
    # Nominal Mar 31 is already a weekday.
    assert schedule.items[1].due_date == dt(2026, 3, 31)
    # Nominal Apr 30 is already a weekday.
    assert schedule.items[2].due_date == dt(2026, 4, 30)

  def test_leap_year_february_29(self):
    # 2028 is a leap year - the 1-month anniversary of Jan 31 clamps to
    # Feb 29, not Feb 28.
    schedule = generate_loan_schedule(
      Decimal("60000000"), Decimal("6"), dt(2028, 1, 31), 2, "unsecured", as_of=dt(2028, 1, 31)
    )
    assert schedule.items[0].due_date == dt(2028, 2, 29)


class TestScheduleStatus:
  def test_loan_not_yet_opened(self):
    calc = calculate_loan(
      Decimal("50000000"), Decimal("10"), dt(2030, 1, 1), 12, "unsecured", as_of=dt(2026, 1, 1)
    )
    assert calc.days_elapsed == 0
    assert calc.is_matured is False

    schedule = generate_loan_schedule(
      Decimal("50000000"), Decimal("10"), dt(2030, 1, 1), 12, "unsecured", as_of=dt(2026, 1, 1)
    )
    statuses = [item.status for item in schedule.items]
    assert statuses[0] == "current"
    assert all(status == "upcoming" for status in statuses[1:])
    assert "completed" not in statuses

  def test_first_due_date_boundary_is_inclusive(self):
    schedule = generate_loan_schedule(
      Decimal("60000000"), Decimal("6"), dt(2026, 1, 1), 12, "unsecured", as_of=dt(2026, 1, 1)
    )
    first_due_date = schedule.items[0].due_date
    at_boundary = generate_loan_schedule(
      Decimal("60000000"), Decimal("6"), dt(2026, 1, 1), 12, "unsecured", as_of=first_due_date
    )
    assert at_boundary.items[0].status == "completed"
    assert at_boundary.items[1].status == "current"

  def test_maturity_boundary(self):
    open_date = dt(2026, 1, 1)
    duration_months = 12
    calc_before = calculate_loan(
      Decimal("60000000"),
      Decimal("6"),
      open_date,
      duration_months,
      "unsecured",
      as_of=dt(2026, 12, 31),
    )
    calc_at = calculate_loan(
      Decimal("60000000"), Decimal("6"), open_date, duration_months, "unsecured", as_of=dt(2027, 1, 1)
    )
    assert calc_before.is_matured is False
    assert calc_at.is_matured is True

  def test_terms_elapsed_mid_loan(self):
    schedule = generate_loan_schedule(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=dt(2026, 8, 11)
    )
    completed = [item for item in schedule.items if item.status == "completed"]
    current = [item for item in schedule.items if item.status == "current"]
    assert len(completed) == 3
    assert len(current) == 1
    assert completed[-1].term == 3
    assert current[0].term == 4


class TestTotalCost:
  def test_total_interest_and_repayment(self):
    schedule = generate_loan_schedule(
      Decimal("100000000"), Decimal("10"), dt(2026, 1, 1), 12, "unsecured", as_of=dt(2026, 1, 1)
    )
    total_interest = sum((item.interest for item in schedule.items), Decimal(0))
    total_principal = sum((item.principal for item in schedule.items), Decimal(0))
    # Every cent of principal disbursed is accounted for across the schedule.
    assert total_principal == Decimal("100000000")
    # Simple sanity bounds: a 10%/yr, 1-year loan costs noticeably more
    # than 0 but well under the principal itself in interest.
    assert Decimal("0") < total_interest < Decimal("100000000")


class TestRounding:
  def test_all_schedule_amounts_are_whole_units(self):
    schedule = generate_loan_schedule(
      Decimal("123456789"), Decimal("13.37"), dt(2026, 2, 3), 37, "unsecured", as_of=dt(2026, 2, 3)
    )
    for item in schedule.items:
      for value in (
        item.opening_principal,
        item.payment,
        item.principal,
        item.interest,
        item.closing_principal,
      ):
        assert value == value.to_integral_value()

  def test_calculate_loan_amounts_are_whole_units(self):
    calc = calculate_loan(
      Decimal("123456789"), Decimal("13.37"), dt(2026, 2, 3), 37, "secured", as_of=dt(2026, 6, 1)
    )
    for value in (calc.accrued_interest, calc.current_balance, calc.monthly_payment):
      assert value == value.to_integral_value()

  def test_decimal_currency_preserves_cents_and_reconciles_principal(self):
    schedule = generate_loan_schedule(
      Decimal("1000"),
      Decimal("0"),
      dt(2026, 1, 1),
      12,
      "unsecured",
      as_of=dt(2026, 1, 1),
      currency="USD",
    )

    assert schedule.monthly_payment == Decimal("83.33")
    assert schedule.items[0].payment == Decimal("83.33")
    assert schedule.items[-1].payment == Decimal("83.37")
    assert sum((item.principal for item in schedule.items), Decimal(0)) == Decimal("1000.00")
    assert all(value.as_tuple().exponent >= -2 for item in schedule.items for value in (
      item.payment,
      item.principal,
      item.interest,
      item.closing_principal,
    ))


class TestLoanDetail:
  def test_matches_real_world_reference_scenario(self):
    detail = build_loan_detail(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=dt(2026, 8, 11)
    )
    assert detail.terms_elapsed == 3
    assert detail.terms_remaining == 57
    assert detail.is_matured is False
    # Pure principal component (not folded with any unsettled interest) -
    # matches calculate_loan's current_balance for unsecured, since that
    # already excludes interest.
    assert detail.current_principal == Decimal("574038167")
    assert detail.estimated_outstanding_balance == Decimal("574038167")
    assert len(detail.schedule) == 60

  def test_principal_repaid_progresses_for_unsecured(self):
    detail = build_loan_detail(
      Decimal("100000000"), Decimal("10"), dt(2026, 1, 1), 12, "unsecured", as_of=dt(2026, 6, 1)
    )
    assert detail.principal_repaid > 0
    assert Decimal("0") < detail.principal_repaid_percent < Decimal("100")
    assert detail.current_principal == Decimal("100000000") - detail.principal_repaid

  def test_principal_repaid_is_always_zero_for_secured(self):
    # The whole point of the fixed-balance model: principal is never paid
    # down by the schedule, so "principal repaid" should read 0% for the
    # entire life of the loan, not something that looks like amortizing
    # progress.
    for as_of in (dt(2026, 1, 1), dt(2027, 6, 1), dt(2030, 12, 31)):
      detail = build_loan_detail(
        Decimal("100000000"), Decimal("10"), dt(2026, 1, 1), 12, "secured", as_of=as_of
      )
      assert detail.principal_repaid == Decimal("0")
      assert detail.principal_repaid_percent == Decimal("0")
      assert detail.current_principal == Decimal("100000000")

  def test_total_repayment_equals_principal_plus_total_interest(self):
    detail = build_loan_detail(
      Decimal("250000000"), Decimal("14.5"), dt(2026, 3, 1), 24, "unsecured", as_of=dt(2026, 3, 1)
    )
    assert detail.total_repayment == Decimal("250000000") + detail.total_interest

  def test_full_schedule_is_returned_regardless_of_as_of(self):
    # The chart/table need the *complete* projected schedule (past and
    # future terms), not just what's happened so far.
    detail = build_loan_detail(
      Decimal("50000000"), Decimal("8"), dt(2026, 1, 1), 18, "unsecured", as_of=dt(2026, 1, 1)
    )
    assert len(detail.schedule) == 18
    assert [item.term for item in detail.schedule] == list(range(1, 19))

  def test_schedule_statuses_are_consistent_with_terms_elapsed(self):
    detail = build_loan_detail(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=dt(2026, 8, 11)
    )
    completed = [item for item in detail.schedule if item.status == "completed"]
    current = [item for item in detail.schedule if item.status == "current"]
    assert len(completed) == detail.terms_elapsed
    assert len(current) == 1


class TestTermsRemaining:
  def test_calculate_loan_exposes_terms_elapsed_and_remaining(self):
    calc = calculate_loan(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=dt(2026, 8, 11)
    )
    assert calc.terms_elapsed == 3
    assert calc.terms_remaining == 57
    assert calc.terms_elapsed + calc.terms_remaining == 60

  def test_terms_remaining_hits_zero_at_maturity(self):
    calc = calculate_loan(
      Decimal("60000000"), Decimal("6"), dt(2026, 1, 1), 12, "unsecured", as_of=dt(2028, 1, 1)
    )
    assert calc.terms_remaining == 0
    assert calc.is_matured is True

  def test_weekend_adjusted_due_date_keeps_term_not_elapsed(self):
    # 2026-06-07 (the *nominal*, unadjusted 1-month anniversary of
    # 2026-05-07) is a Sunday; the actual due date is pushed to Monday
    # 2026-06-08. Querying exactly on that Sunday must NOT count the
    # term as elapsed yet, even though the nominal anniversary date has
    # technically passed - only the real (adjusted) due date matters.
    as_of_sunday = dt(2026, 6, 7)
    assert as_of_sunday.weekday() == 6  # sanity check: this really is a Sunday

    calc = calculate_loan(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=as_of_sunday
    )
    assert calc.terms_elapsed == 0
    assert calc.terms_remaining == 60

    schedule = generate_loan_schedule(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=as_of_sunday
    )
    assert schedule.items[0].status == "current"

    # One day later (the adjusted Monday due date), the term is elapsed.
    calc_monday = calculate_loan(
      Decimal("596000000"), Decimal("12"), dt(2026, 5, 7), 60, "unsecured", as_of=dt(2026, 6, 8)
    )
    assert calc_monday.terms_elapsed == 1
    assert calc_monday.terms_remaining == 59
