"use client"
import { useMemo } from 'react';

interface TrainingRound {
  id: number;
  roundNumber: number;
  modelAccuracy: number | null;
  loss: number | null;
  participatingPeers: number;
  startTime: string;
  endTime: string | null;
  status: string;
}

interface TrainingChartProps {
  data: TrainingRound[];
}

export function TrainingChart({ data }: TrainingChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data
      .filter(round => round.modelAccuracy !== null && round.status === 'completed')
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .slice(-10); // Show last 10 rounds
  }, [data]);

  const maxAccuracy = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map(d => d.modelAccuracy || 0));
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 bg-gray-900 rounded-lg border border-gray-600 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-gray-400 mb-2">No training data available</p>
          <p className="text-sm text-gray-500">Complete training rounds to see metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 bg-gray-900 rounded-lg border border-gray-600 p-4">
      <div className="h-full flex items-end justify-center space-x-2">
        {chartData.map((round, index) => {
          const accuracy = round.modelAccuracy || 0;
          const height = (accuracy / maxAccuracy) * 100;
          const isLatest = index === chartData.length - 1;
          
          return (
            <div
              key={round.id}
              className="flex flex-col items-center group relative"
              style={{ height: '100%' }}
            >
              {/* Bar */}
              <div
                className={`w-8 rounded-t transition-all duration-300 hover:opacity-80 ${
                  isLatest ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ height: `${height}%`, minHeight: '4px' }}
              />
              
              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap border border-gray-600 transition-opacity">
                <div>Round {round.roundNumber}</div>
                <div>Accuracy: {(accuracy * 100).toFixed(1)}%</div>
                <div>Peers: {round.participatingPeers}</div>
              </div>
              
              {/* Round label */}
              <div className="text-xs text-gray-400 mt-1">
                R{round.roundNumber}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8">
        <span>{(maxAccuracy * 100).toFixed(0)}%</span>
        <span>{(maxAccuracy * 50).toFixed(0)}%</span>
        <span>0%</span>
      </div>
      
      {/* Chart title */}
      <div className="absolute top-2 left-4 text-sm text-gray-400">
        Model Accuracy Over Training Rounds
      </div>
    </div>
  );
}