"use client"
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";
import { predefinedModels, getModelConfig, type ModelConfig } from "@/lib/modelConfig";
import { 
  Brain, 
  Upload, 
  Play, 
  Download,
  FileText,
  Image,
  BarChart3,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings,
  Database,
  AlertTriangle,
  Cpu
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TrainingSession {
  id: string;
  modelConfig: ModelConfig;
  dataUploaded: boolean;
  participatingPeers: string[];
  status: 'preparing' | 'waiting_for_peers' | 'training' | 'aggregating' | 'completed' | 'failed';
  progress: number;
  results?: {
    accuracy: number;
    loss: number;
    predictions?: any[];
  };
}

export default function ModelsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [customModel, setCustomModel] = useState<Partial<ModelConfig>>({});
  const [uploadedData, setUploadedData] = useState<File | null>(null);
  const [dataPreview, setDataPreview] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingStatus, setTrainingStatus] = useState<any>(null);
  const [trainingMetrics, setTrainingMetrics] = useState<any>(null);

  const [trainingConfig, setTrainingConfig] = useState({
    epochs: 5,
    batchSize: 32,
    learningRate: 0.001,
    requireMinimumPeers: false
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const { isConnected: wsConnected } = useWebSocket();

  // Queries
  const { data: networkStatus } = useQuery({
    queryKey: ['/api/network/status'],
    refetchInterval: 5000,
  });

  const { data: trainingStatusData } = useQuery({
    queryKey: ['/api/training/status'],
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (trainingStatusData) {
      setTrainingStatus(trainingStatusData);
      setTrainingProgress(trainingStatusData.currentRound / trainingStatusData.totalRounds * 100);
      setTrainingMetrics(trainingStatusData.metrics);
    }
  }, [trainingStatusData]);

  const { data: connectedPeers = [] } = useQuery({
    queryKey: ['/api/peers/connected'],
    refetchInterval: 3000,
  });

  // Mutations
  const initializeModelMutation = useMutation({
    mutationFn: (model: ModelConfig) => 
      apiRequest('POST', '/api/model/initialize', { 
        config: {
          inputShape: model.inputShape,
          outputShape: model.outputShape,
          numClasses: model.numClasses,
          learningRate: model.learningRate,
          batchSize: model.batchSize,
          epochs: model.epochs
        }
      }),
    onSuccess: () => {
      toast({
        title: "Model Initialized",
        description: `${selectedModel?.name} has been initialized successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Initialize Model",
        description: error.message,
      });
    },
  });

  const uploadDataMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`${API_URL}/api/data/upload`, {
        method: 'POST',
        body: formData, // Don't set Content-Type header - browser will set it with boundary
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload data');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setDataPreview(data.preview);
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          dataUploaded: true,
          status: 'waiting_for_peers'
        });
      }
      toast({
        title: "Data Uploaded",
        description: "Training data has been uploaded and processed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Upload Data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startTrainingMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/training/federated/start'),
    onSuccess: () => {
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          status: 'training',
          progress: 0
        });
      }
      toast({
        title: "Federated Training Started",
        description: "Waiting for other peers to join the training session.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Training",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // WebSocket event handlers
  useEffect(() => {
    const handleTrainingProgress = (data: any) => {
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          progress: (data.epoch / data.totalEpochs) * 100
        });
      }
    };

    const handlePeerJoined = (data: any) => {
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          participatingPeers: [...currentSession.participatingPeers, data.peerId]
        });
      }
    };

    const handleTrainingCompleted = (data: any) => {
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          status: 'completed',
          progress: 100,
          results: {
            accuracy: data.accuracy,
            loss: data.loss,
            predictions: data.predictions
          }
        });
      }
      toast({
        title: "Training Completed",
        description: `Model achieved ${(data.accuracy * 100).toFixed(1)}% accuracy.`,
      });
    };

    if (wsConnected) {
      window.addEventListener('ml-training-progress', handleTrainingProgress as any);
      window.addEventListener('ml-peer-joined', handlePeerJoined as any);
      window.addEventListener('ml-training-completed', handleTrainingCompleted as any);
    }

    return () => {
      window.removeEventListener('ml-training-progress', handleTrainingProgress as any);
      window.removeEventListener('ml-peer-joined', handlePeerJoined as any);
      window.removeEventListener('ml-training-completed', handleTrainingCompleted as any);
    };
  }, [wsConnected, currentSession, toast]);

  const handleModelSelect = (modelId: string) => {
    const config = getModelConfig(modelId);
    if (config) {
      setSelectedModel(config);
      setCurrentSession({
        id: `session_${Date.now()}`,
        modelConfig: config,
        dataUploaded: false,
        participatingPeers: [],
        status: 'preparing',
        progress: 0
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedModel) {
      setUploadedData(file);

      console.log(file, selectedModel)

      const formData = new FormData();
      formData.append('file', file);
      formData.append('modelType', selectedModel.type);
      formData.append('modelId', selectedModel.id);

      uploadDataMutation.mutate(formData);
    }
  };

  const handleStartTraining = async () => {
    if (!selectedModel || !wsConnected) return;

    try {
      // First initialize the model with the selected configuration
      await fetch(`${API_URL}/api/model/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            inputShape: selectedModel.inputShape,
            outputShape: selectedModel.outputShape,
            numClasses: selectedModel.numClasses,
            learningRate: trainingConfig.learningRate,
            batchSize: trainingConfig.batchSize,
            epochs: trainingConfig.epochs
          }
        })
      });

      // Start federated training
      const response = await fetch(`${API_URL}/api/training/federated/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.id,
          config: trainingConfig,
          requireMinimumPeers: trainingConfig.requireMinimumPeers,
          minimumPeers: 2
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start training');
      }

      const result = await response.json();
      console.log('Training started:', result);
      setIsTraining(true);
      setTrainingProgress(0);
    } catch (error) {
      console.error('Failed to start training:', error);
      alert(`Failed to start training: ${error.message}`);
    }
  };

  const handleSimulateTraining = async () => {
    if (!selectedModel || !wsConnected) return;

    try {
      // Initialize model first
      await fetch(`${API_URL}/api/model/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            inputShape: selectedModel.inputShape,
            outputShape: selectedModel.outputShape,
            numClasses: selectedModel.numClasses,
            learningRate: trainingConfig.learningRate,
            batchSize: trainingConfig.batchSize,
            epochs: trainingConfig.epochs
          }
        })
      });

      // Start simulation training
      const response = await fetch(`${API_URL}/api/training/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.id,
          config: trainingConfig
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start training simulation');
      }

      setIsTraining(true);
      setTrainingProgress(0);
    } catch (error) {
      console.error('Failed to start training simulation:', error);
      alert(`Failed to start training simulation: ${error.message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'preparing': return <Settings className="h-4 w-4" />;
      case 'waiting_for_peers': return <Users className="h-4 w-4" />;
      case 'training': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'aggregating': return <Database className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case 'image_classification': return <Image className="h-5 w-5" />;
      case 'regression': return <BarChart3 className="h-5 w-5" />;
      case 'text_classification': return <FileText className="h-5 w-5" />;
      case 'time_series': return <Clock className="h-5 w-5" />;
      default: return <Brain className="h-5 w-5" />;
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white">ML Model Management</h2>
          <p className="text-gray-400 mt-1">Select, train, and deploy federated learning models</p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant={wsConnected ? "default" : "destructive"} className="px-3 py-1">
            <div className={`w-2 h-2 rounded-full mr-2 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {wsConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Badge variant="secondary" className="px-3 py-1">
            {connectedPeers.length} Peers
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="models" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="models">Model Selection</TabsTrigger>
          <TabsTrigger value="data">Data Upload</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* Model Selection Tab */}
        <TabsContent value="models" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Choose a Model</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {predefinedModels.map((model) => (
                  <Card 
                    key={model.id}
                    className={`cursor-pointer transition-colors ${
                      selectedModel?.id === model.id 
                        ? 'bg-blue-900 border-blue-500' 
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                    }`}
                    onClick={() => handleModelSelect(model.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-3">
                        {getModelTypeIcon(model.type)}
                        <div>
                          <CardTitle className="text-white text-lg">{model.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {model.type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 text-sm mb-3">{model.description}</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <div>Input: {model.inputShape.join('×')}</div>
                        <div>Output: {model.outputShape.join('×')}</div>
                        <div>Format: {model.dataFormat}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedModel && (
                <Alert className="mt-6 bg-blue-900 border-blue-500">
                  <Brain className="h-4 w-4" />
                  <AlertDescription className="text-blue-100">
                    Selected: <strong>{selectedModel.name}</strong>
                    <Button 
                      className="ml-4"
                      size="sm"
                      onClick={() => initializeModelMutation.mutate(selectedModel)}
                      disabled={initializeModelMutation.isPending}
                    >
                      {initializeModelMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Settings className="h-4 w-4 mr-2" />
                      )}
                      Initialize Model
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Upload Tab */}
        <TabsContent value="data" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Upload Training Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedModel ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select a model first before uploading data.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="data-file" className="text-white">
                        Upload {selectedModel.dataFormat.toUpperCase()} file
                      </Label>
                      <Input
                        id="data-file"
                        type="file"
                        accept={
                          selectedModel.dataFormat === 'image' ? 'image/*,.zip' :
                          selectedModel.dataFormat === 'csv' ? '.csv' :
                          selectedModel.dataFormat === 'json' ? '.json' :
                          '.txt'
                        }
                        onChange={handleFileUpload}
                        className="mt-1"
                      />
                    </div>

                    {uploadDataMutation.isPending && (
                      <div className="flex items-center space-x-2 text-blue-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing uploaded data...</span>
                      </div>
                    )}

                    {dataPreview && (
                      <Card className="bg-gray-700 border-gray-600">
                        <CardHeader>
                          <CardTitle className="text-white text-lg">Data Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-gray-300 text-sm overflow-auto max-h-40">
                            {JSON.stringify(dataPreview, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="text-sm text-gray-400">
                    <p><strong>Expected format for {selectedModel.name}:</strong></p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {selectedModel.dataFormat === 'image' && (
                        <>
                          <li>ZIP file containing images organized in folders by class</li>
                          <li>Individual image files (jpg, png)</li>
                          <li>Images should be {selectedModel.inputShape[0]}×{selectedModel.inputShape[1]} pixels</li>
                        </>
                      )}
                      {selectedModel.dataFormat === 'csv' && (
                        <>
                          <li>CSV file with features in columns</li>
                          <li>Target variable in the last column</li>
                          <li>No headers if possible, or clearly labeled</li>
                        </>
                      )}
                      {selectedModel.dataFormat === 'text' && (
                        <>
                          <li>Text file with one sample per line</li>
                          <li>Format: "text,label" or separate text and label files</li>
                        </>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Tab */}
        <TabsContent value="training" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Play className="h-5 w-5 mr-2" />
                Federated Training
              </CardTitle>
              <CardDescription>
                Start collaborative model training across the P2P network
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isTraining ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-900 rounded-lg">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-3" />
                      <span className="text-blue-100">Training in progress...</span>
                    </div>
                    <Badge variant="secondary">Round {trainingStatus?.currentRound}</Badge>
                  </div>
                  <Progress value={trainingProgress} className="w-full" />
                  <p className="text-sm text-gray-400">
                    {connectedPeers.length} peers participating in this training round
                  </p>

                  {/* Training metrics */}
                  {trainingMetrics && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-800 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-400">Current Loss</p>
                        <p className="text-lg font-bold text-white">{trainingMetrics.loss?.toFixed(4) || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Accuracy</p>
                        <p className="text-lg font-bold text-white">
                          {trainingMetrics.accuracy ? `${(trainingMetrics.accuracy * 100).toFixed(1)}%` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="training-epochs">Training Epochs</Label>
                      <Input
                        id="training-epochs"
                        type="number"
                        value={trainingConfig.epochs}
                        onChange={(e) => setTrainingConfig(prev => ({
                          ...prev,
                          epochs: parseInt(e.target.value) || 5
                        }))}
                        min="1"
                        max="100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="batch-size">Batch Size</Label>
                      <Input
                        id="batch-size"
                        type="number"
                        value={trainingConfig.batchSize}
                        onChange={(e) => setTrainingConfig(prev => ({
                          ...prev,
                          batchSize: parseInt(e.target.value) || 32
                        }))}
                        min="1"
                        max="512"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="learning-rate">Learning Rate</Label>
                    <Input
                      id="learning-rate"
                      type="number"
                      step="0.0001"
                      value={trainingConfig.learningRate}
                      onChange={(e) => setTrainingConfig(prev => ({
                        ...prev,
                        learningRate: parseFloat(e.target.value) || 0.001
                      }))}
                      min="0.0001"
                      max="1"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="require-peers"
                      checked={trainingConfig.requireMinimumPeers}
                      onChange={(e) => setTrainingConfig(prev => ({
                        ...prev,
                        requireMinimumPeers: e.target.checked
                      }))}
                    />
                    <Label htmlFor="require-peers">Require minimum peers (federated mode)</Label>
                  </div>

                  <div className="space-y-2">
                    <Button 
                      onClick={handleStartTraining} 
                      disabled={!wsConnected || !selectedModel}
                      className="w-full"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Federated Training
                    </Button>

                    <Button 
                      onClick={handleSimulateTraining} 
                      disabled={!wsConnected || !selectedModel}
                      variant="outline"
                      className="w-full"
                    >
                      <Cpu className="h-4 w-4 mr-2" />
                      Simulate Local Training
                    </Button>
                  </div>

                  {connectedPeers.length === 0 && (
                    <div className="p-4 bg-yellow-900 rounded-lg">
                      <p className="text-yellow-100 text-sm">
                        <AlertTriangle className="h-4 w-4 inline mr-2" />
                        No peers connected. Use simulation mode or connect peers first.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Training Results</CardTitle>
            </CardHeader>
            <CardContent>
              {!currentSession?.results ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No training results available. Complete a training session to see results.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-6">
                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-lg">Model Accuracy</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-400">
                          {(currentSession.results.accuracy * 100).toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-lg">Final Loss</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-400">
                          {currentSession.results.loss.toFixed(4)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Predictions Preview */}
                  {currentSession.results.predictions && (
                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Sample Predictions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-gray-300 text-sm overflow-auto max-h-60">
                          {JSON.stringify(currentSession.results.predictions.slice(0, 10), null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  )}

                  {/* Export Options */}
                  <div className="flex space-x-4">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download Model
                    </Button>
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Export Results
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}