import React from "react";
import PropTypes from "prop-types";
import { Container } from "reactstrap";

// Wraps page content with consistent max-width and padding.
const PageContainer = ({ children, fluid, className, ...rest }) => {
  return (
    <Container fluid={fluid} className={`gh-page${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </Container>
  );
};

PageContainer.propTypes = {
  children: PropTypes.node,
  fluid: PropTypes.bool,
  className: PropTypes.string,
};

PageContainer.defaultProps = {
  fluid: true,
};

export default PageContainer;
