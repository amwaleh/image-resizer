import React from "react";
import ReactDOM from "react-dom";

import "./styles.css";

const formatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2
});

/**
 * Polifyll to use `canvas.toBlob()` on Microsoft Edge
 */
if (!HTMLCanvasElement.prototype.toBlob) {
  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    value: function(callback, type, quality) {
      const dataURL = this.toDataURL(type, quality).split(",")[1];
      setTimeout(() => {
        const binStr = atob(dataURL),
          len = binStr.length,
          arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          arr[i] = binStr.charCodeAt(i);
        }
        callback(new Blob([arr], { type }));
      });
    }
  });
}

/**
 * Convert a File to a base64 string
 * @param {File} file
 * @return {string}
 */
const toBase64 = file => {
  if (!(file instanceof File) && !(file instanceof Blob)) return;

  const reader = new FileReader();
  let resolve = null;
  let reject = null;

  reader.readAsDataURL(file);
  reader.onload = function onReaderLoad() {
    resolve(reader.result);
  };

  reader.onerror = function onReaderError(error) {
    reject(error);
  };

  return new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
};

/**
 * Load a base64 string to a Image object
 * @param {string} data
 * @return {Image}
 */
const createImageFromBase64 = data =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = data;
    img.addEventListener("load", () => {
      resolve(img);
    });
    img.addEventListener("error", reject);
  });

/**
 * Helper to calcule the new image size with aspect ratio
 * @param {object} options
 */
const getDimensionsProportionally = ({
  width,
  height,
  maxWidth,
  maxHeight
}) => {
  let newWidth;
  let newHeight;
  if (width > height) {
    newWidth = Math.min(maxWidth, width);
    const ratio = newWidth / width;
    newHeight = ratio * height;
  } else {
    newHeight = Math.min(maxHeight, height);
    const ratio = newHeight / height;
    newWidth = ratio * width;
  }
  return {
    width: newWidth,
    height: newHeight
  };
};

/**
 * Writes a canvas context to a File object
 * @param {object} options
 * @return {Promise<File>}
 */
const writeContextToFile = ({ context, quality = 1, fileType, fileName }) =>
  new Promise((resolve, reject) => {
    context.canvas.toBlob(
      blob => {
        let transformedImageFile;
        if (navigator.msSaveBlob) {
          // if in Microsoft Edge, then fake the "Blob" to
          // a "File" object.
          transformedImageFile = blob;
          transformedImageFile.lastModifiedDate = new Date();
          transformedImageFile.lastModified = Date.now();
          transformedImageFile.name = fileName;
        } else {
          transformedImageFile = new File([blob], fileName, {
            type: fileType,
            lastModified: Date.now(),
            lastModifiedDate: new Date()
          });
        }
        resolve(transformedImageFile);
      },
      fileType,
      quality
    );
  });

/**
 *  Transform a image File to a new reduced image File
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @return {Promise<File>}
 */
const transform = async (file, maxWidth, maxHeight) => {
  const fileData = await toBase64(file);
  const img = await createImageFromBase64(fileData);

  const { width, height } = getDimensionsProportionally({
    width: img.width,
    height: img.height,
    maxWidth,
    maxHeight
  });

  if (width >= img.width) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const transformedFile = await writeContextToFile({
    context: ctx,
    quality: 0.9,
    fileName: file.name,
    fileType: file.type
  });

  return transformedFile;
};

const ClickabeImage = props => {
  const handleClick = () => {
    if (props.src) {
      window.open(props.src, "_blank");
    }
  };

  const onImgLoad  = ({target:img}) => {
    console.log({dimensions:{height:img.offsetHeight,
                               width:img.offsetWidth}});
}

  return (
    <div
    style={{
      width: "500px",
      height: "500px",
      backgroundColor: "white",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
    >
    <div style={{
      width: "300px",
      height: "300px",
   
      position: "absolute",
      
      border: '1px solid red'
      }}/>
    <img
      alt=""
      {...props}
      onClick={handleClick}
      onLoad={onImgLoad}
      style={{
        ...props.style,
        cursor: "pointer",
        objectFit: "contain",
        maxHeight:"600px"
      }}
    />
    </div>
  );
};

class App extends React.Component {
  state = {
    file: null,
    fileSize: 0,
    resized: null,
    resizedSize: 0
  };

  _onChange = async event => {
    if (event.target.files && event.target.files.length) {
      const file = event.target.files[0];
      const fileData = URL.createObjectURL(file);
      this.setState({
        startedAt: new Date(),
        originalFile: file,
        original: fileData,
        originalSize: file.size
      });
      const transformedFile = await transform(file, 1000, 1000);
      const transformedFileData = URL.createObjectURL(transformedFile);
      this.setState({
        resizedFile: transformedFile,
        resized: transformedFileData,
        resizedSize: transformedFile.size,
        finishedAt: new Date()
      });
    }
  };

  render() {
    const {
      original,
      originalSize,
      resized,
      resizedSize,
      startedAt,
      finishedAt
    } = this.state;
    const saved =
      originalSize && resizedSize < originalSize
        ? 100 - (resizedSize / originalSize) * 100
        : 0;
    console.log({
      originalSize,
      resizedSize,
      saved
    });
    return (
      <div className="App">
        <h2>Select an image to reduce up to 1280 pixels.</h2>
        <br />
        <input
          type="file"
          accept="image/jpg,image/jpeg,image/png"
          onChange={this._onChange}
        />
        <br />
        <br />
        <div
          style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}
        >
          {original ? (
            <div style={{ flex: 1, marginRight: 8 }}>
              <h3>Original</h3>
              <ClickabeImage
                src={original}
               
                alt="original"
              />
              <br />
              
              <div>Original size: {formatter.format(Math.round(originalSize/(1048576)))} bytes</div>
            </div>
          ) : null}

          {resized ? (
            <div style={{ flex: 1, marginRight: 8 }}>
              <h3>Resized</h3>
              <ClickabeImage
                src={resized}
                width="300"
                height="300"
                alt="resized"
              />
              <br />
              <div>Resized size: {formatter.format(resizedSize)} bytes</div>
              <div>Saved: {formatter.format(saved)} %</div>
              {startedAt && finishedAt ? (
                <div>
                  Time spent:{" "}
                  {formatter.format(
                    (finishedAt.getTime() - startedAt.getTime()) / 1000
                  )}{" "}
                  seconds
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
