"""Combine focused test classes while preserving the original CLI selectors."""
from __future__ import annotations

import unittest

from .tests import test_calculations, test_contracts, test_features


class ContractTests(
    test_contracts.ContractSchemaTests,
    test_calculations.CalculationTests,
    test_features.FeatureTests,
):
    """Compatibility suite: every focused scenario is inherited exactly once."""


def main() -> None:
    """Keep unittest flags and selectors such as ContractTests.test_zero_defaults."""
    unittest.main(module=__name__, verbosity=2)
