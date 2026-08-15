"""Correlation: groups and aggregates findings across analyzers.

The v1 implementation is deliberately lightweight (severity/relatedness
grouping). Later iterations can implement cross-finding reasoning, e.g.
a leaked secret plus a high-risk dependency in the same component.
"""
