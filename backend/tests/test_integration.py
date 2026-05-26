"""
Integration test: parcel submission → task queued → worker routes → status updated.
Requires DATABASE_URL pointing to a real test DB. Skip if not available.
"""

import pytest
import os


pytestmark = pytest.mark.skipif(
    os.getenv("INTEGRATION_TEST") != "1",
    reason="Set INTEGRATION_TEST=1 to run integration tests",
)
