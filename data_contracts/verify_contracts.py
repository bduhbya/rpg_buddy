"""Run the file-contract verifier; production game rules belong in TypeScript.

Usage remains: python data_contracts/verify_contracts.py
Focused check: append ContractTests.test_zero_defaults
The implementation and typed tests live in verification/. VS Code can keep
launching this file; place calculation/validation breakpoints in those modules.
"""
from verification.runner import main


if __name__ == "__main__":
    main()
