from datetime import datetime
from pydantic import BaseModel
from typing import List

class ComplianceStatus(BaseModel):
    framework: str
    score: int
    status: str
    violations: int

class ReportSummary(BaseModel):
    projectName: str
    scanId: int
    generatedAt: datetime
    overallScore: int
    grade: str
    totalFindings: int
    criticalCount: int
    highCount: int
    mediumCount: int
    lowCount: int
    compliance: List[ComplianceStatus]
