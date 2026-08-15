"""Exception hierarchy for the analysis engine."""


class AnalysisError(Exception):
    """Base class for all engine errors."""


class SourceResolutionError(AnalysisError):
    """The project source could not be resolved into a local directory."""


class SourceNotFoundError(SourceResolutionError):
    """A local path does not exist or is not a directory."""


class UnsupportedSourceError(SourceResolutionError):
    """The source descriptor is invalid or unsupported (e.g. non-https URL)."""


class AnalyzerError(AnalysisError):
    """An analyzer failed while running."""


class AnalyzerNotAvailableError(AnalyzerError):
    """An analyzer is registered but not implemented/configured yet."""
