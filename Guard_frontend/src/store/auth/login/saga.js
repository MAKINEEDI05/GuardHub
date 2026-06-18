import { call, put, takeEvery, takeLatest } from "redux-saga/effects";

// Login Redux States
import { LOGIN_USER, LOGOUT_USER, SOCIAL_LOGIN } from "./actionTypes";
import { apiError, loginSuccess, logoutUserSuccess } from "./actions";

//Include Both Helper File with needed methods
import { getFirebaseBackend } from "../../../helpers/firebase_helper";
import {
  postFakeLogin,
  postJwtLogin,
} from "../../../helpers/fakebackend_helper";
import axios from "axios";


const fireBaseBackend = getFirebaseBackend();
const base_url = process.env.REACT_APP_API_BASE_URL;

function* loginUser({ payload: { user, history } }) {
  console.log(user);
  console.log('comingggg')

  // localStorage.setItem("authUser", JSON.stringify({userName: 'Admin', password: "Aditya@123"}));
  // history("/gokartingadmin/dashboard");

  try {
        let response;
    
        if (process.env.REACT_APP_DEFAULTAUTH === "firebase") {
          response = fireBaseBackend.loginUser(user.email, user.password);
          // Assuming fireBaseBackend.loginUser is a promise-based function
          // history("/");
        } else if (process.env.REACT_APP_DEFAULTAUTH === "jwt") {
          // history("/");
          console.log('getting on1')
          response = axios.post(base_url + "/login", user);
          if(response){
            console.log(response)
            response.then((result) => {
              const userdt = result.user;
              localStorage.setItem("authUser", JSON.stringify(userdt));
              history("/dashboard");
              console.log(userdt);
            }).catch((error) => {
              alert('Enter Valid Credentials')
              console.error('Promise rejected:', error);
            });
          }
          else{
            alert('Enter Valid Credentials')
          }
        } else if (process.env.REACT_APP_DEFAULTAUTH === "fake") {
          console.log('getting on2')
          // localStorage.setItem("authUser", JSON.stringify({userBranch: "Admin", userPass: 'Aditya@123'}));
          // history("/dashboard");
          console.log(base_url + "/login",user)
          response = axios.post(base_url + "/login", user);
          console.log(response);
          if(response){
            console.log(response)
            response.then((result) => {
              const userdt = result.user;
              localStorage.setItem("authUser", JSON.stringify(userdt));
              history("/dashboard");
              console.log(userdt);
            }).catch((error) => {
              alert('Enter Valid Credentials')
              console.error('Promise rejected:', error);
            });
          }
          else{
            alert('Enter Valid Credentials')
          }
        }
      } catch (error) {
        alert('Enter Valid Credentials')
        console.log('Login error:', error);
        // Dispatch apiError action here if you're using Redux
        // yield put(apiError(error));
      }

  try {
    if (process.env.REACT_APP_DEFAULTAUTH === "firebase") {
      const response = yield call(
        fireBaseBackend.loginUser,
        user.email,
        user.password
      );
      yield put(loginSuccess(response));
    } else if (process.env.REACT_APP_DEFAULTAUTH === "jwt") {
      const response = yield call(postJwtLogin, {
        email: user.email,
        password: user.password,
      });
      localStorage.setItem("authUser", JSON.stringify(response));
      yield put(loginSuccess(response));
    } else if (process.env.REACT_APP_DEFAULTAUTH === "fake") {
      const response = yield call(postFakeLogin, {
        email: user.email,
        password: user.password,
      });
      localStorage.setItem("authUser", JSON.stringify(response));
      yield put(loginSuccess(response));
    }
    history("/");
  } catch (error) {
    yield put(apiError(error));
  }
}


function* logoutUser({ payload: { history } }) {
  try {
    localStorage.removeItem("authUser");

    if (process.env.REACT_APP_DEFAULTAUTH === "firebase") {
      const response = yield call(fireBaseBackend.logout);
      yield put(logoutUserSuccess(response));
    }
    history('/login');
  } catch (error) {
    yield put(apiError(error));
  }
}

function* socialLogin({ payload: { type, history } }) {
  try {
    if (process.env.REACT_APP_DEFAULTAUTH === "firebase") {
      const fireBaseBackend = getFirebaseBackend();
      const response = yield call(fireBaseBackend.socialLoginUser, type);
      if (response) {
        history("/dashboard");
      } else {
        history("/login");
      }
      localStorage.setItem("authUser", JSON.stringify(response));
      yield put(loginSuccess(response));
    }
    const response = yield call(fireBaseBackend.socialLoginUser, type);
    if(response)
    history("/dashboard");
  } catch (error) {
    yield put(apiError(error));
  }
}

function* authSaga() {
  yield takeEvery(LOGIN_USER, loginUser);
  yield takeLatest(SOCIAL_LOGIN, socialLogin);
  yield takeEvery(LOGOUT_USER, logoutUser);
}

export default authSaga;
