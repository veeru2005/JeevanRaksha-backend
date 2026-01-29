# JeevanRaksha Backend API

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Update the `.env` file with your MongoDB connection string:

```env
PORT=5000
MONGO_URI=mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/jeevanraksha?retryWrites=true&w=majority
```

Or use local MongoDB:
```env
MONGO_URI=mongodb://localhost:27017/jeevanraksha
```

### 3. Start the Server
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start on http://localhost:5000

## API Endpoints

### Health Check
- **GET** `/api/health` - Check server and database status

### Patient Management
- **GET** `/api/patients` - Get all patients
- **GET** `/api/patients/:id` - Get patient by ID
- **PUT** `/api/patients/:id` - Update patient information

### Registration
- **POST** `/api/register/aadhaar` - Register with Aadhaar card
  ```json
  {
    "aadhaarNumber": "123456789012",
    "otp": "123456",
    "fullName": "John Doe",
    "mobileNumber": "9876543210",
    "email": "john@example.com",
    "consentGiven": true
  }
  ```

- **POST** `/api/register/driving-license` - Register with Driving License
  ```json
  {
    "drivingLicenseNumber": "DL-1420110012345",
    "dateOfBirth": "1990-01-01",
    "fullName": "John Doe",
    "mobileNumber": "9876543210",
    "email": "john@example.com"
  }
  ```

### Emergency Access
- **GET** `/api/emergency/:qrCode` - Get critical patient data by QR code

## Database Schema

### Patient Model
- registrationType: 'aadhaar' | 'driving_license'
- aadhaarNumber: String (12 digits, unique)
- drivingLicenseNumber: String (unique)
- fullName: String (required)
- mobileNumber: String (10 digits, required)
- email: String
- bloodType: String
- allergies: Array
- emergencyContacts: Array
- medicalConditions: Array
- medications: Array
- qrCode: String (unique identifier)
- timestamps: createdAt, updatedAt

## Technologies Used
- Node.js
- Express.js
- MongoDB with Mongoose
- CORS
- dotenv
