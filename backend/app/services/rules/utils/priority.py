from __future__ import annotations


def shift_priorities_for_insert(
    rules,
    new_priority: int,
    exclude_rule_id=None,
):
    """
    Shift priorities downward when inserting
    or moving a rule.

    Example:

    Existing:
        1 insurance
        2 mail
        3 regular

    Insert at priority 2:
        1 insurance
        2 fragile
        3 mail
        4 regular
    """

    for rule in rules:

        if (
            exclude_rule_id
            and str(rule.id) == str(exclude_rule_id)
        ):
            continue

        if rule.priority >= new_priority:
            rule.priority += 1