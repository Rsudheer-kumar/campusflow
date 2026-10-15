"use client";
import React, { Component } from "react";
import { SceneFallback } from "./scene-fallback";
export class WebGLErrorBoundary extends Component {
    state = {
        hasError: false,
    };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, errorInfo) {
        console.warn("WebGL Error caught by boundary:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback || <SceneFallback />;
        }
        return this.props.children;
    }
}
