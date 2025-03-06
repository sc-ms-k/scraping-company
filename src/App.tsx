import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, FileSpreadsheet, Database, RefreshCw, AlertCircle, Download, Settings, Globe, Search } from 'lucide-react';
import { fetchCharityPage, Charity, updateScraperConfig, getScraperConfig, ScraperConfig } from './api/scraper';

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [processedCount, setProcessedCount] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [states, setStates] = useState<{[key: string]: number}>({});
  const [charityData, setCharityData] = useState<Charity[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scraperConfig, setScraperConfig] = useState(getScraperConfig());
  const [sourceUrl, setSourceUrl] = useState(scraperConfig.sourceUrl);

  const addLogMessage = (message: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  useEffect(() => {
    // Load any saved data from localStorage
    try {
      const savedData = localStorage.getItem('scrapedData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setCharityData(parsedData);
        
        // Calculate states count
        const stateCount: {[key: string]: number} = {};
        parsedData.forEach((charity: Charity) => {
          const state = charity.state || 'Unknown';
          stateCount[state] = (stateCount[state] || 0) + 1;
        });
        setStates(stateCount);
        
        addLogMessage(`Loaded ${parsedData.length} items from local storage`);
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (charityData.length > 0) {
      localStorage.setItem('scrapedData', JSON.stringify(charityData));
    }
  }, [charityData]);

  const processNextPage = useCallback(async () => {
    if (!isRunning || processedCount >= 1000) {
      setIsProcessing(false);
      return;
    }
    
    try {
      setIsProcessing(true);
      addLogMessage(`Processing page ${currentPage}...`);
      
      // Fetch charity data from the current page
      const { charities, hasMore } = await fetchCharityPage(currentPage);
      
      if (charities.length === 0) {
        setHasMorePages(false);
        setIsRunning(false);
        setIsProcessing(false);
        addLogMessage('No more items found. Scraping complete.');
        return;
      }
      
      // Update state counts
      setStates(prev => {
        const newStates = { ...prev };
        charities.forEach(charity => {
          const state = charity.state || 'Unknown';
          newStates[state] = (newStates[state] || 0) + 1;
        });
        return newStates;
      });
      
      // Add to charity data
      setCharityData(prev => [...prev, ...charities]);
      
      // Update current page
      setCurrentPage(prev => prev + 1);
      
      // Update processed count
      const newProcessedCount = processedCount + charities.length;
      setProcessedCount(newProcessedCount > 1000 ? 1000 : newProcessedCount);
      
      addLogMessage(`Processed page ${currentPage}, found ${charities.length} new items`);
      
      // Check if we've reached the batch limit
      if (newProcessedCount >= 1000) {
        setIsRunning(false);
        setIsProcessing(false);
        addLogMessage('Batch complete. Click "Continue" to process the next batch.');
        return;
      }
      
      // Check if there are more pages
      setHasMorePages(hasMore);
      if (!hasMore) {
        setIsRunning(false);
        setIsProcessing(false);
        addLogMessage('No more items found. Scraping complete.');
        return;
      }
      
      // Process the next page after a delay
      setTimeout(() => {
        setIsProcessing(false);
        processNextPage();
      }, 1000);
    } catch (error) {
      console.error('Error processing page:', error);
      addLogMessage(`Error processing page ${currentPage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsRunning(false);
      setIsProcessing(false);
    }
  }, [currentPage, processedCount, isRunning]);

  // Start or continue scraping
  const startScraping = useCallback(() => {
    if (!hasMorePages && currentPage > 1) {
      addLogMessage('No more items to scrape. All pages have been processed.');
      return;
    }
    
    // Update the scraper config with the current source URL
    const newConfig: ScraperConfig = {
      ...scraperConfig,
      sourceUrl
    };
    
    updateScraperConfig(newConfig);
    setScraperConfig(newConfig);
    addLogMessage(`Using source URL: ${sourceUrl}`);
    
    setIsRunning(true);
    addLogMessage('Starting scraper...');
    
    // Start processing pages
    processNextPage();
  }, [hasMorePages, currentPage, processNextPage, sourceUrl, scraperConfig]);

  // Effect to monitor isRunning state and trigger processing
  useEffect(() => {
    if (isRunning && !isProcessing) {
      processNextPage();
    }
  }, [isRunning, isProcessing, processNextPage]);

  const pauseScraping = () => {
    setIsRunning(false);
    addLogMessage('Scraper paused. Click "Continue" to resume.');
  };

  const resetScraper = () => {
    if (window.confirm('Are you sure you want to reset? This will clear all collected data.')) {
      setIsRunning(false);
      setCurrentPage(1);
      setProcessedCount(0);
      setLog([]);
      setStates({});
      setCharityData([]);
      setHasMorePages(true);
      setIsProcessing(false);
      localStorage.removeItem('scrapedData');
      addLogMessage('Scraper reset. Ready to start.');
    }
  };

  const exportToCSV = useCallback(() => {
    if (charityData.length === 0) {
      addLogMessage('No data to export');
      return;
    }

    setIsExporting(true);
    addLogMessage('Preparing CSV export...');

    try {
      // Sort charities alphabetically by name
      const sortedCharities = [...charityData].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      // Create CSV content
      const headers = ['Name', 'Address', 'Website', 'Email', 'State'];
      const csvContent = [
        headers.join(','),
        ...sortedCharities.map(charity => 
          [
            `"${charity.name.replace(/"/g, '""')}"`,
            `"${charity.address.replace(/"/g, '""')}"`,
            `"${charity.website.replace(/"/g, '""')}"`,
            `"${charity.email?.replace(/"/g, '""') || ''}"`,
            `"${charity.state}"`
          ].join(',')
        )
      ].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `scraped_data_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addLogMessage(`Exported ${sortedCharities.length} items to CSV`);
      setIsExporting(false);
    } catch (error: any) {
      addLogMessage(`Error exporting data: ${error.message}`);
      setIsExporting(false);
    }
  }, [charityData]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Anything Scraper Tool</h1>
              <p className="text-gray-600">Scrape data from any website and export to CSV</p>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
              >
                <Settings size={18} className="mr-2" />
                Settings
              </button>
              
              <button 
                onClick={exportToCSV}
                disabled={isExporting || charityData.length === 0}
                className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center ${(isExporting || charityData.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Download size={18} className="mr-2" />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>
        </header>
        
        {showSettings && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Advanced Settings</h2>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Note: For demonstration purposes, this tool uses mock data instead of actually scraping websites.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CSS Selectors
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="itemsSelector" className="block text-xs text-gray-500 mb-1">
                    Items Selector
                  </label>
                  <input
                    type="text"
                    id="itemsSelector"
                    value={scraperConfig.selectors.items}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label htmlFor="nameSelector" className="block text-xs text-gray-500 mb-1">
                    Name Selector
                  </label>
                  <input
                    type="text"
                    id="nameSelector"
                    value={scraperConfig.selectors.name}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label htmlFor="addressSelector" className="block text-xs text-gray-500 mb-1">
                    Address Selector
                  </label>
                  <input
                    type="text"
                    id="addressSelector"
                    value={scraperConfig.selectors.address}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label htmlFor="websiteSelector" className="block text-xs text-gray-500 mb-1">
                    Website Selector
                  </label>
                  <input
                    type="text"
                    id="websiteSelector"
                    value={scraperConfig.selectors.website}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                These selectors are used to extract data from the web pages. In a full version, these would be editable.
              </p>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Scraper Control</h2>
                
                <div className="flex space-x-2">
                  {!isRunning ? (
                    <button 
                      onClick={startScraping}
                      disabled={(!hasMorePages && currentPage > 1) || isProcessing}
                      className={`bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center ${((!hasMorePages && currentPage > 1) || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Play size={18} className="mr-2" />
                      {processedCount > 0 && processedCount < 1000 ? 'Continue' : 'Start'}
                    </button>
                  ) : (
                    <button 
                      onClick={pauseScraping}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md flex items-center"
                    >
                      <Pause size={18} className="mr-2" />
                      Pause
                    </button>
                  )}
                  <button 
                    onClick={resetScraper}
                    disabled={isProcessing}
                    className={`bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md flex items-center ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <RefreshCw size={18} className="mr-2" />
                    Reset
                  </button>
                </div>
              </div>
              
              <div className="mb-6">
                <label htmlFor="sourceUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  Source URL
                </label>
                <div className="flex">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="sourceUrl"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://example.com/page="
                      className="block w-full pl-10 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      disabled={isRunning}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the URL to scrape. The tool will append page numbers to this URL.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-500">Current Page</p>
                  <p className="text-2xl font-bold">{currentPage}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-500">Processed Items</p>
                  <p className="text-2xl font-bold">{processedCount} / 1000</p>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${(processedCount / 1000) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-gray-500">
                  <Database size={16} className="mr-2" />
                  <span>Total items collected: {charityData.length}</span>
                </div>
                
                {charityData.length > 0 && (
                  <button 
                    onClick={exportToCSV}
                    disabled={isExporting}
                    className={`text-sm text-blue-600 hover:text-blue-800 flex items-center ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <FileSpreadsheet size={16} className="mr-1" />
                    {isExporting ? 'Exporting...' : 'Quick Export'}
                  </button>
                )}
              </div>
            </div>
            
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Log</h2>
              <div className="bg-gray-900 text-gray-200 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
                {log.length > 0 ? (
                  log.map((message, index) => (
                    <div key={index} className="mb-1">{message}</div>
                  ))
                ) : (
                  <div className="text-gray-500">No log messages yet. Start the scraper to see activity.</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Database size={20} className="mr-2 text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-800">Data Summary</h2>
              </div>
              
              {Object.keys(states).length > 0 && (
                <div className="text-sm font-medium text-gray-600">
                  {Object.keys(states).length} categories
                </div>
              )}
            </div>
            
            {Object.keys(states).length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Object.entries(states)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-md flex items-center justify-center font-bold">
                          {category.substring(0, 2)}
                        </div>
                        <span className="ml-3 text-gray-700">{category}</span>
                      </div>
                      <span className="bg-gray-100 px-2 py-1 rounded-md text-gray-700 font-medium">
                        {count} items
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No data collected yet</p>
                <p className="text-sm mt-2">Start the scraper to collect data</p>
              </div>
            )}
            
            {Object.keys(states).length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button 
                  onClick={exportToCSV}
                  disabled={isExporting}
                  className={`w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md flex items-center justify-center ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Download size={18} className="mr-2" />
                  Export All Data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;