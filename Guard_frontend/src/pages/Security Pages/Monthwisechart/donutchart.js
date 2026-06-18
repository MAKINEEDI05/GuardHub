import React, { useEffect, useRef, useState, useCallback } from "react";
import Chart from "react-apexcharts";

const DonutChart = ({ labels, series, colors, onSegmentClick }) => {
  const chartRef = useRef(null);
  const [isChartInitialized, setIsChartInitialized] = useState(false);
  const isMountedRef = useRef(true); // Track if the component is mounted

  // Memoized click handler to ensure stability
  const handleSegmentClick = useCallback(
    (category) => {
      if (isMountedRef.current && onSegmentClick) {
        console.log("Calling onSegmentClick with category:", category);
        setTimeout(() => {
          if (isMountedRef.current) {
            onSegmentClick(category);
          }
        }, 0); // Defer to avoid race condition with re-render
      } else {
        console.warn("Component unmounted or onSegmentClick not provided, ignoring click.");
      }
    },
    [onSegmentClick]
  );

  // Initialize and cleanup chart
  useEffect(() => {
    console.log("DonutChart mounted, initializing chart...");
    if (chartRef.current && chartRef.current.chart) {
      setIsChartInitialized(true);
      console.log("Chart initialized successfully.");
    }
    isMountedRef.current = true;

    return () => {
      console.log("DonutChart unmounting...");
      isMountedRef.current = false;
      if (chartRef.current && chartRef.current.chart) {
        try {
          chartRef.current.chart.destroy();
          setIsChartInitialized(false);
          console.log("Chart destroyed successfully.");
        } catch (err) {
          console.warn("Error destroying chart:", err);
        }
      }
    };
  }, [labels, series]); // Re-run when labels or series change

  // Validate props
  if (!labels || !Array.isArray(labels) || labels.length === 0) {
    console.error("Invalid labels prop:", labels);
    return <div className="text-center py-4 text-muted">Invalid chart labels.</div>;
  }

  if (!series || !Array.isArray(series) || series.length !== labels.length || !series.every(val => typeof val === "number")) {
    console.error("Invalid series prop:", series);
    return <div className="text-center py-4 text-muted">Invalid chart data.</div>;
  }

  const options = {
    chart: {
      type: "donut",
      events: {
        dataPointSelection: (event, chartContext, config) => {
          console.log("dataPointSelection triggered:", { event, chartContext, config });
          if (!isChartInitialized || !chartContext || !config || typeof config.dataPointIndex !== "number") {
            console.warn("Chart not initialized or invalid selection data, ignoring click:", {
              isChartInitialized,
              chartContext,
              config,
            });
            return;
          }
          const category = labels[config.dataPointIndex];
          if (category) {
            console.log("Processing click for category:", category);
            handleSegmentClick(category);
          } else {
            console.warn("No category found for index:", config.dataPointIndex);
          }
        },
      },
    },
    labels: labels,
    colors: colors,
    legend: {
      position: "bottom",
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: { width: 200 },
          legend: { position: "bottom" },
        },
      },
    ],
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              formatter: () => series.reduce((a, b) => a + b, 0),
            },
          },
        },
      },
    },
  };

  return (
    <div className="donut-chart">
      <Chart
        ref={chartRef}
        options={options}
        series={series}
        type="donut"
        height={350}
      />
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(DonutChart, (prevProps, nextProps) => {
  return (
    prevProps.labels === nextProps.labels &&
    prevProps.series === nextProps.series &&
    prevProps.colors === nextProps.colors &&
    prevProps.onSegmentClick === nextProps.onSegmentClick
  );
});