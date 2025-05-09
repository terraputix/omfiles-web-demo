import {
  OmFileReader,
  FileBackend,
  MemoryHttpBackend,
  type OmFileReaderBackend,
  type Range,
  OmDataType,
  CompressionType,
} from "@openmeteo/file-reader";

// Define Plotly globally since it's included via CDN
declare global {
  interface Window {
    Plotly: any;
  }
}

/**
 * Main application class to handle state and DOM interactions
 */
class OmFileViewer {
  // State
  private reader: OmFileReader | null = null;
  private currentTimestamp = 0;
  private maxTimestamp = 0;
  private dimensions: number[] = [];
  private timeIndex = 2;
  private latIndex = 0;
  private lonIndex = 1;
  private metadata: Record<string, any> = {};

  // DOM elements
  private loadButton: HTMLButtonElement;
  private loadDataButton: HTMLButtonElement;
  private dataUrlInput: HTMLInputElement;
  private fileInput: HTMLInputElement;
  private prevButton: HTMLButtonElement;
  private nextButton: HTMLButtonElement;
  private timestampLabel: HTMLElement;
  private plotArea: HTMLElement;
  private metadataArea: HTMLElement;
  private latSelect: HTMLSelectElement;
  private lonSelect: HTMLSelectElement;
  private timeSelect: HTMLSelectElement;

  constructor() {
    // Get DOM elements
    this.loadButton = document.getElementById(
      "loadButton",
    ) as HTMLButtonElement;
    this.dataUrlInput = document.getElementById("dataUrl") as HTMLInputElement;
    this.fileInput = document.getElementById("fileInput") as HTMLInputElement;
    this.prevButton = document.getElementById(
      "prevButton",
    ) as HTMLButtonElement;
    this.nextButton = document.getElementById(
      "nextButton",
    ) as HTMLButtonElement;
    this.timestampLabel = document.getElementById(
      "timestampLabel",
    ) as HTMLElement;
    this.plotArea = document.getElementById("plotArea") as HTMLElement;
    this.metadataArea = document.getElementById("metadataArea") as HTMLElement;
    this.latSelect = document.getElementById("latSelect") as HTMLSelectElement;
    this.lonSelect = document.getElementById("lonSelect") as HTMLSelectElement;
    this.timeSelect = document.getElementById(
      "timeSelect",
    ) as HTMLSelectElement;

    // Initialize event listeners
    this.loadButton.addEventListener("click", () => this.loadData());
    this.prevButton.addEventListener("click", () =>
      this.showPreviousTimestamp(),
    );
    this.nextButton.addEventListener("click", () => this.showNextTimestamp());
    this.fileInput.addEventListener("change", () => this.handleFileSelection());

    this.loadDataButton = document.getElementById(
      "loadDataButton",
    ) as HTMLButtonElement;

    // Add event listener for the new button
    this.loadDataButton.addEventListener("click", () =>
      this.loadAndDisplayData(),
    );

    // Add new event listeners that only update dimensions without loading data
    this.latSelect.addEventListener("change", () =>
      this.updateDimensionIndices(),
    );
    this.lonSelect.addEventListener("change", () =>
      this.updateDimensionIndices(),
    );
    this.timeSelect.addEventListener("change", () =>
      this.updateDimensionIndices(),
    );
  }

  /**
   * Update dimension indices without loading data
   */
  private updateDimensionIndices(): void {
    if (!this.reader) return;

    this.latIndex = parseInt(this.latSelect.value);
    this.lonIndex = parseInt(this.lonSelect.value);
    this.timeIndex = parseInt(this.timeSelect.value);

    // Reset timestamp to 0 when changing time dimension
    this.currentTimestamp = 0;
    this.maxTimestamp = this.dimensions[this.timeIndex] - 1;

    // Update UI
    this.prevButton.disabled = this.currentTimestamp === 0;
    this.nextButton.disabled = this.currentTimestamp >= this.maxTimestamp;
    this.timestampLabel.textContent = `Timestamp: ${this.currentTimestamp}`;
  }

  /**
   * Handle when a file is selected via the file input
   */
  private async handleFileSelection(): Promise<void> {
    const files = this.fileInput.files;
    if (files && files.length > 0) {
      try {
        // Create backend for the selected file
        const backend = await this.createBackend(files[0]);

        // Create and initialize reader
        this.reader = await OmFileReader.create(backend);

        // Load metadata
        await this.loadMetadata();

        // Get dimensions and setup UI
        this.setupDimensionsAndUI();

        // Don't load data automatically - wait for button click
      } catch (error) {
        console.error("Error loading file:", error);
        alert(
          `Error loading file: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        console.log("File loaded");
      }
    }
  }

  /**
   * Display metadata in the UI
   */
  private displayMetadata(): void {
    // Clear previous content
    this.metadataArea.innerHTML = "";

    // Create metadata section
    const metadataSection = document.createElement("div");
    metadataSection.className = "metadata-section";

    // Add heading
    const heading = document.createElement("h3");
    heading.textContent = "File Metadata";
    metadataSection.appendChild(heading);

    // Create table for metadata
    const table = document.createElement("table");
    table.className = "metadata-table";

    // Add metadata keys and values
    for (const [key, value] of Object.entries(this.metadata)) {
      const row = document.createElement("tr");

      const keyCell = document.createElement("td");
      keyCell.className = "metadata-key";
      keyCell.textContent = key;
      row.appendChild(keyCell);

      const valueCell = document.createElement("td");
      valueCell.className = "metadata-value";
      valueCell.textContent =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      row.appendChild(valueCell);

      table.appendChild(row);
    }

    metadataSection.appendChild(table);
    this.metadataArea.appendChild(metadataSection);
  }

  /**
   * Setup dimensions and UI after reader is initialized
   */
  private setupDimensionsAndUI(): void {
    if (!this.reader) return;

    // Get dimensions
    this.dimensions = this.reader.getDimensions();

    if (this.dimensions.length < 2) {
      throw new Error("Data must have at least 2 dimensions");
    }

    // Populate dimension selection dropdowns
    this.populateDimensionDropdowns();

    // Default indices are already set
    // Set dropdown values
    this.latSelect.value = String(this.latIndex);
    this.lonSelect.value = String(this.lonIndex);
    this.timeSelect.value = String(this.timeIndex);

    // Set max timestamp
    this.maxTimestamp = this.dimensions[this.timeIndex] - 1;
    this.currentTimestamp = 0;

    // Update UI
    this.prevButton.disabled = this.currentTimestamp === 0;
    this.nextButton.disabled = this.currentTimestamp >= this.maxTimestamp;
    this.timestampLabel.textContent = `Timestamp: ${this.currentTimestamp}`;
  }

  /**
   * Populate dimension selection dropdowns
   */
  private populateDimensionDropdowns(): void {
    // Clear existing options
    this.latSelect.innerHTML = "";
    this.lonSelect.innerHTML = "";
    this.timeSelect.innerHTML = "";

    // Add options for each dimension
    for (let i = 0; i < this.dimensions.length; i++) {
      const option = document.createElement("option");
      option.value = String(i);
      option.text = `(${this.dimensions[i]})`;

      this.latSelect.add(option.cloneNode(true) as HTMLOptionElement);
      this.lonSelect.add(option.cloneNode(true) as HTMLOptionElement);
      this.timeSelect.add(option.cloneNode(true) as HTMLOptionElement);
    }
  }

  /**
   * Creates the appropriate backend based on the input type (URL or File)
   */
  private async createBackend(
    input: string | File,
  ): Promise<OmFileReaderBackend> {
    // Check if input is a File object (local file)
    if (input instanceof File) {
      console.log("Creating FileBackend for local file:", input.name);
      return new FileBackend(input);
    }

    // Input is a URL string
    const url = input as string;

    // For HTTP or HTTPS URLs, use MemoryHttpBackend
    console.log("Creating MemoryHttpBackend for URL:", url);
    return new MemoryHttpBackend({
      url: url,
      maxFileSize: 500 * 1024 * 1024, // 500 MB
      debug: true,
      onProgress: (loaded, total) => {
        const percent = Math.round((loaded / total) * 100);
        console.log(`Downloaded: ${loaded} / ${total} bytes (${percent}%)`);
      },
    });
  }

  /**
   * Loads data from the specified URL
   */
  private async loadData(): Promise<void> {
    try {
      const url = this.dataUrlInput.value.trim();
      if (!url) {
        alert("Please enter a valid URL");
        return;
      }

      this.loadButton.disabled = true;
      this.loadButton.textContent = "Loading...";

      // Create appropriate backend
      const backend = await this.createBackend(url);

      // Create and initialize the OM file reader
      this.reader = await OmFileReader.create(backend);

      // Get metadata
      await this.loadMetadata();

      // Setup dimensions and UI
      this.setupDimensionsAndUI();

      this.loadButton.textContent = "Load Data";
      this.loadButton.disabled = false;
    } catch (error) {
      console.error("Error loading data:", error);
      alert(
        `Error loading data: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.loadButton.textContent = "Load Data";
      this.loadButton.disabled = false;
    }
  }

  /**
   * Load metadata from the file and display it
   */
  private async loadMetadata(): Promise<void> {
    if (!this.reader) return;

    try {
      // Get metadata
      let children = this.reader.numberOfChildren();
      let variableName = this.reader.getName();
      let dimensions = this.reader.getDimensions();
      let compression = this.reader.compression();
      let dataType = this.reader.dataType();
      let chunkDimensions = this.reader.getChunkDimensions();

      this.metadata = {
        children: children,
        variableName: variableName,
        dimensions: dimensions,
        compression: getEnumKeyByValue(CompressionType, compression),
        dataType: getEnumKeyByValue(OmDataType, dataType),
        chunkDimensions: chunkDimensions,
      };

      console.log("Metadata:", this.metadata);

      // Display metadata
      this.displayMetadata();
    } catch (error) {
      console.warn("Couldn't load metadata:", error);
    }
  }

  /**
   * Loads and displays data for the current timestamp
   */
  private async loadAndDisplayData(): Promise<void> {
    if (!this.reader) {
      console.error("Reader not initialized");
      return;
    }

    try {
      // Create ranges for each dimension
      const ranges: Range[] = this.dimensions.map((dim, i) => {
        if (i === this.timeIndex) {
          // Time dimension - select only current timestamp
          return {
            start: this.currentTimestamp,
            end: this.currentTimestamp + 1,
          };
        } else {
          // Other dimensions - select all
          return { start: 0, end: dim };
        }
      });

      // Read data for the specified dimensions
      const data = await this.reader.read(OmDataType.FloatArray, ranges);

      // Reshape data for plotting
      const rows = this.dimensions[this.latIndex];
      const cols = this.dimensions[this.lonIndex];
      const plotData: number[][] = [];

      // Create 2D array for heatmap
      for (let i = 0; i < rows; i++) {
        const row: number[] = [];
        for (let j = 0; j < cols; j++) {
          row.push(data[i * cols + j]);
        }
        plotData.push(row);
      }

      // Find min/max for color scaling
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;

      for (let i = 0; i < data.length; i++) {
        if (!isNaN(data[i])) {
          if (data[i] < min) min = data[i];
          if (data[i] > max) max = data[i];
        }
      }

      // Create heatmap configuration
      const heatmap = {
        z: plotData,
        type: "heatmap",
        colorscale: "Viridis",
        zmin: min,
        zmax: max,
      };

      const layout = {
        title: `Data Visualization - Timestamp ${this.currentTimestamp}`,
        margin: {
          l: 50,
          r: 50,
          b: 50,
          t: 50,
        },
      };

      // Plot using Plotly
      window.Plotly.newPlot(this.plotArea, [heatmap], layout);
    } catch (error) {
      console.error("Error displaying data:", error);
      alert(
        `Error displaying data: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Navigate to the previous timestamp
   */
  private async showPreviousTimestamp(): Promise<void> {
    if (this.currentTimestamp > 0) {
      this.currentTimestamp--;
      this.timestampLabel.textContent = `Timestamp: ${this.currentTimestamp}`;
      this.prevButton.disabled = this.currentTimestamp === 0;
      this.nextButton.disabled = false;
      await this.loadAndDisplayData();
    }
  }

  /**
   * Navigate to the next timestamp
   */
  private async showNextTimestamp(): Promise<void> {
    if (this.currentTimestamp < this.maxTimestamp) {
      this.currentTimestamp++;
      this.timestampLabel.textContent = `Timestamp: ${this.currentTimestamp}`;
      this.prevButton.disabled = false;
      this.nextButton.disabled = this.currentTimestamp >= this.maxTimestamp;
      await this.loadAndDisplayData();
    }
  }
}

function getEnumKeyByValue<T extends Record<string, any>>(
  enumObj: T,
  value: T[keyof T],
): keyof T | undefined {
  return Object.keys(enumObj).find(
    (key) => enumObj[key as keyof T] === value,
  ) as keyof T | undefined;
}

/**
 * Initialize the application when the DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  new OmFileViewer();
});
