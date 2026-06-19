import PropTypes from "prop-types"
import React, { useCallback, useEffect, useRef } from "react"

// //Import Scrollbar
import SimpleBar from "simplebar-react"

// MetisMenu
import MetisMenu from "metismenujs"
import withRouter from "components/Common/withRouter"
import { Link } from "react-router-dom"

//i18n
import { withTranslation } from "react-i18next"

const SidebarContent = props => {
  const ref = useRef();
  const activateParentDropdown = useCallback((item) => {
    item.classList.add("active");
    const parent = item.parentElement;
    const parent2El = parent.childNodes[1];

    if (parent2El && parent2El.id !== "side-menu") {
      parent2El.classList.add("mm-show");
    }

    if (parent) {
      parent.classList.add("mm-active");
      const parent2 = parent.parentElement;

      if (parent2) {
        parent2.classList.add("mm-show"); // ul tag

        const parent3 = parent2.parentElement; // li tag

        if (parent3) {
          parent3.classList.add("mm-active"); // li
          parent3.childNodes[0].classList.add("mm-active"); //a
          const parent4 = parent3.parentElement; // ul
          if (parent4) {
            parent4.classList.add("mm-show"); // ul
            const parent5 = parent4.parentElement;
            if (parent5) {
              parent5.classList.add("mm-show"); // li
              parent5.childNodes[0].classList.add("mm-active"); // a tag
            }
          }
        }
      }
      scrollElement(item);
      return false;
    }
    scrollElement(item);
    return false;
  }, []);

  const removeActivation = (items) => {
    for (var i = 0; i < items.length; ++i) {
      var item = items[i];
      const parent = items[i].parentElement;

      if (item && item.classList.contains("active")) {
        item.classList.remove("active");
      }
      if (parent) {
        const parent2El =
          parent.childNodes && parent.childNodes.lenght && parent.childNodes[1]
            ? parent.childNodes[1]
            : null;
        if (parent2El && parent2El.id !== "side-menu") {
          parent2El.classList.remove("mm-show");
        }

        parent.classList.remove("mm-active");
        const parent2 = parent.parentElement;

        if (parent2) {
          parent2.classList.remove("mm-show");

          const parent3 = parent2.parentElement;
          if (parent3) {
            parent3.classList.remove("mm-active"); // li
            parent3.childNodes[0].classList.remove("mm-active");

            const parent4 = parent3.parentElement; // ul
            if (parent4) {
              parent4.classList.remove("mm-show"); // ul
              const parent5 = parent4.parentElement;
              if (parent5) {
                parent5.classList.remove("mm-show"); // li
                parent5.childNodes[0].classList.remove("mm-active"); // a tag
              }
            }
          }
        }
      }
    }
  };

  const activeMenu = useCallback(() => {
    const pathName = process.env.PUBLIC_URL + props.router.location.pathname;
    let matchingMenuItem = null;
    const ul = document.getElementById("side-menu");
    const items = ul.getElementsByTagName("a");
    removeActivation(items);

    for (let i = 0; i < items.length; ++i) {
      if (pathName === items[i].pathname) {
        matchingMenuItem = items[i];
        break;
      }
    }
    if (matchingMenuItem) {
      activateParentDropdown(matchingMenuItem);
    }
  }, [props.router.location.pathname, activateParentDropdown]);

  useEffect(() => {
    ref.current.recalculate();
  }, []);

  useEffect(() => {
    new MetisMenu("#side-menu");
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    activeMenu();
  }, [activeMenu]);

  function scrollElement(item) {
    if (item) {
      const currentPosition = item.offsetTop;
      if (currentPosition > window.innerHeight) {
        ref.current.getScrollElement().scrollTop = currentPosition - 300;
      }
    }
  }

  return (
    <React.Fragment>
      <SimpleBar style={{ maxHeight: "100%" }} ref={ref}>
        <div id="sidebar-menu">
          <ul className="metismenu list-unstyled" id="side-menu">
            <li className="menu-title">{props.t("Main")} </li>
            <li>
              <Link to="/dashboard" className="waves-effect">
                <i className="mdi mdi-view-dashboard"></i>
                <span>{props.t("Dashboard")}</span>
              </Link>
            </li>

            {/* ////////////////////     my components     /////////////////////////// */}
            <li className="menu-title">{props.t("My Components")}</li>

            <li>
              <Link to="/profilepage" className=" waves-effect">
                <i className="mdi mdi-account"></i>
                <span>{props.t("Profile")}</span>
              </Link>
            </li>
            <li>
              <Link to="/day-wise-report" className=" waves-effect">
                <i className="mdi mdi-calendar-today"></i>
                <span>{props.t("Day-Wise-Report")}</span>
              </Link>
            </li>
            <li>
              <Link to="/month-wise-report" className=" waves-effect">
                <i className="mdi mdi-calendar-month"></i>
                <span>{props.t("Month-Wise-Report")}</span>
              </Link>
            </li>
            <li>
              <Link to="/LeaveOdManagement" className=" waves-effect">
                <i className="mdi mdi-calendar-clock"></i>
                <span>{props.t("View Leaves/ODs")}</span>
              </Link>
            </li>
            <li>
              <Link to="/applied-od" className=" waves-effect">
                <i className="mdi mdi-calendar-plus"></i>
                <span>{props.t("Apply Leave/OD")}</span>
              </Link>
            </li>
            <li>
              <Link to="/security-roaster" className=" waves-effect">
                <i className="mdi mdi-shield-account"></i>
                <span>{props.t("Security Roaster")}</span>
              </Link>
            </li>
            {/* <li>
              <Link to="/day-month-report" className=" waves-effect">
                <i className="mdi mdi-chart-line"></i>
                <span>{props.t("Day Month Report")}</span>
              </Link>
            </li>
            <li>
              <Link to="/coustom-month-report" className=" waves-effect">
                <i className="mdi mdi-chart-bar"></i>
                <span>{props.t("Custom Month Report")}</span>
              </Link>
            </li>


            <li>
              <Link to="/contactus" className=" waves-effect">
                <i className="mdi mdi-phone"></i>
                <span>{props.t("Contact Us")}</span>
              </Link>
            </li> */}
          </ul>
        </div>
      </SimpleBar>
    </React.Fragment>
  )
}

SidebarContent.propTypes = {
  location: PropTypes.object,
  t: PropTypes.any,
}

export default withRouter(withTranslation()(SidebarContent))
