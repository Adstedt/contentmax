#!/bin/bash
echo "Starting D3 Performance Test Server..."
echo ""
echo "After server starts, open your browser to:"
echo "  - http://localhost:8080/d3-performance-test.html (Main test)"
echo "  - http://localhost:8080/svg-comparison.html (SVG vs Canvas)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
npx http-server . -p 8080 -o