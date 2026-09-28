"""
Comprehensive logging module for Byjan Business
Provides structured logging with trace context and integration health tracking
"""

import structlog
import logging
import sys
from typing import Optional, Dict, Any
from datetime import datetime
from functools import wraps
import inspect
import asyncio


# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# Configure standard logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)

logger = structlog.get_logger(__name__)


class TraceContext:
    """Context manager for tracing operations"""

    def __init__(self, module: str, action: str, integration: Optional[str] = None, **kwargs):
        self.module = module
        self.action = action
        self.integration = integration
        self.context = {
            "module": module,
            "action": action,
            "integration": integration,
            **kwargs,
        }
        self.start_time = datetime.utcnow()
        self.request_id = kwargs.get("request_id")

    def __enter__(self):
        logger.info("trace_start", **self.context)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.utcnow() - self.start_time).total_seconds()
        status = "success" if exc_type is None else "error"

        log_data = {
            **self.context,
            "duration_ms": round(duration * 1000, 2),
            "status": status,
        }

        if exc_type:
            log_data["error_type"] = exc_type.__name__
            log_data["error_message"] = str(exc_val)

        if status == "success":
            logger.info("trace_complete", **log_data)
        else:
            logger.error("trace_error", **log_data)


def trace(module: str, action: str, integration: Optional[str] = None):
    """Decorator for tracing function calls"""

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            ctx = TraceContext(module=module, action=action, integration=integration)
            with ctx:
                return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            ctx = TraceContext(module=module, action=action, integration=integration)
            with ctx:
                return func(*args, **kwargs)

        return async_wrapper if inspect.iscoroutinefunction(func) else sync_wrapper

    return decorator


def log_integration_event(
    integration: str,
    event: str,
    status: str,
    details: Optional[Dict[str, Any]] = None,
    severity: str = "info",
):
    """Log integration event"""
    log_data = {
        "integration": integration,
        "event": event,
        "status": status,
        "severity": severity,
        "timestamp": datetime.utcnow().isoformat(),
    }

    if details:
        log_data["details"] = details

    if severity == "critical":
        logger.critical("integration_critical", **log_data)
    elif severity == "warning":
        logger.warning("integration_warning", **log_data)
    elif severity == "error":
        logger.error("integration_error", **log_data)
    else:
        logger.info("integration_event", **log_data)


def log_business_event(
    tenant_id: str,
    module: str,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
):
    """Log business event"""
    log_data = {
        "tenant_id": tenant_id,
        "module": module,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "timestamp": datetime.utcnow().isoformat(),
    }

    if details:
        log_data["details"] = details

    logger.info("business_event", **log_data)


def log_security_event(
    user_id: str,
    action: str,
    ip: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
):
    """Log security event"""
    log_data = {
        "user_id": user_id,
        "action": action,
        "ip": ip,
        "timestamp": datetime.utcnow().isoformat(),
    }

    if details:
        log_data["details"] = details

    logger.info("security_event", **log_data)


def log_performance(
    operation: str,
    duration_ms: float,
    details: Optional[Dict[str, Any]] = None,
):
    """Log performance metric"""
    log_data = {
        "operation": operation,
        "duration_ms": duration_ms,
        "timestamp": datetime.utcnow().isoformat(),
    }

    if details:
        log_data["details"] = details

    logger.info("performance_metric", **log_data)


# Context-aware logging helpers
class LoggingContext:
    """Context for adding common fields to all logs"""

    def __init__(self):
        self.context = {}

    def set(self, key: str, value: Any):
        """Set context value"""
        self.context[key] = value

    def get_logger(self, name: str):
        """Get logger with context"""
        return structlog.get_logger(name).bind(**self.context)


# Global logging context
_context = LoggingContext()


def set_log_context(key: str, value: Any):
    """Set global logging context"""
    _context.set(key, value)


def get_contextual_logger(name: str):
    """Get logger with global context"""
    return _context.get_logger(name)
